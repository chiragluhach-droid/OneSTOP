const Staff = require('../models/Staff');
const School = require('../models/School');
const { INTAKE_EMAIL, INTAKE_LABEL } = require('../config/intake');
const { resolveOwnerLabel } = require('./ownerIdentity');

// Who an overdue concern goes *up* to.
//
// Escalation used to send every overdue concern to one mailbox, so the same
// senior person received alerts about desks they do not supervise. An
// escalation is only actionable by the person the holder actually reports to,
// so it is routed one rung up the chain:
//
//   One Stop desk        -> the escalation authority (Dean of Student Welfare)
//   HOD                  -> the Dean of that request's school
//   Dean                 -> the escalation authority
//   director / other     -> the escalation authority
//   the authority itself -> the final authority (the VC), if one is set
//
// The top of the chain is therefore reached only when the authority below it
// has itself sat on something, which is the point: the VC hears about the
// exceptions, not about everything.

const norm = (e) => String(e || '').trim().toLowerCase();

/** The owner's rung, worked out from the Staff record or the school's own fields. */
const rankOf = async (email, school) => {
  const clean = norm(email);
  if (!clean) return 'unknown';
  if (clean === norm(INTAKE_EMAIL)) return 'intake';

  if (school) {
    if (norm(school.hodEmail) === clean) return 'hod';
    if (norm(school.deanEmail) === clean) return 'dean';
  }

  const staff = await Staff.findOne({ email: clean }).select('role').lean();
  if (staff?.role === 'hod') return 'hod';
  if (staff?.role === 'dean') return 'dean';
  if (staff?.role === 'dsw') return 'intake';

  // Not in the directory under a known rank, and not one of this school's
  // officers — a department office or director.
  const anySchool = await School.findOne({ hodEmail: clean }).select('_id').lean();
  if (anySchool) return 'hod';
  const anyDean = await School.findOne({ deanEmail: clean }).select('_id').lean();
  if (anyDean) return 'dean';

  return 'staff';
};

/**
 * The escalation recipients for a stage, and a line explaining the hop.
 *
 * `config` is the `escalation` setting. When `reportingChain` is switched off
 * the configured authority receives everything, which is the old behaviour.
 */
const escalationTargetFor = async ({ stage, request, config, school = null }) => {
  const authorityEmail = norm(config.recipientEmail);
  const authorityLabel = config.recipientLabel || 'Dean of Student Welfare';
  const finalEmail = norm(config.finalAuthorityEmail);
  const finalLabel = config.finalAuthorityLabel || 'Vice Chancellor';

  const ownerEmail = norm((stage.recipientEmails || [])[0]);
  const ownerLabel = stage.ownerLabel || (await resolveOwnerLabel(ownerEmail));

  const authority = authorityEmail
    ? { emails: [authorityEmail], label: authorityLabel, rung: 'authority' }
    : { emails: [], label: authorityLabel, rung: 'authority' };

  if (config.reportingChain === false) return { ...authority, ownerLabel, ownerEmail };

  // The authority itself is overdue — the only case that reaches the top.
  if (ownerEmail && ownerEmail === authorityEmail) {
    if (finalEmail) return { emails: [finalEmail], label: finalLabel, rung: 'final', ownerLabel, ownerEmail };
    return { emails: [], label: finalLabel, rung: 'final', ownerLabel, ownerEmail };
  }

  const rank = await rankOf(ownerEmail, school);

  if (rank === 'hod') {
    // A school is loaded by the caller where it has one; fall back to the
    // school that actually lists this address, so a cross-school forward still
    // reaches the right dean.
    const owning = school && norm(school.hodEmail) === ownerEmail
      ? school
      : await School.findOne({ hodEmail: ownerEmail }).select('name deanEmail').lean();

    const deanEmail = norm(owning?.deanEmail);
    if (deanEmail && deanEmail !== ownerEmail) {
      return {
        emails: [deanEmail],
        label: `Dean — ${owning.name}`,
        rung: 'dean',
        ownerLabel,
        ownerEmail,
      };
    }
  }

  // Deans, directors, department offices and the One Stop desk all answer to
  // the escalation authority.
  return { ...authority, ownerLabel, ownerEmail };
};

module.exports = { escalationTargetFor, rankOf, INTAKE_LABEL };
