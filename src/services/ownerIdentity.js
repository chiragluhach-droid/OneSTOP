const Staff = require('../models/Staff');
const School = require('../models/School');
const { INTAKE_EMAIL, INTAKE_LABEL } = require('../config/intake');

// Students are shown who holds their request by designation, never by mailbox.
// A raw address is both unhelpful ("hodcst@mru.edu.in" means nothing to a first
// year) and an invitation to email staff directly, bypassing the workflow.
const ROLE_LABELS = {
  dsw: INTAKE_LABEL,
  dean: 'Dean',
  hod: 'Head of Department',
  staff: 'University Official',
};

const FALLBACK_LABEL = 'University Official';

/**
 * Resolve a designation for an email address, in order of how specific it is:
 *
 *   1. the One Stop desk itself
 *   2. a Staff record — its `name` is already written as a title
 *      ("Dean - School of Engineering", "HOD CST"), so prefer it
 *   3. a School that lists the address as its dean or HOD
 *   4. a generic label, so the student always sees something
 */
const resolveOwnerLabel = async (email) => {
  const clean = String(email || '').trim().toLowerCase();
  if (!clean) return FALLBACK_LABEL;

  if (clean === INTAKE_EMAIL) return INTAKE_LABEL;

  const staff = await Staff.findOne({ email: clean }).select('name designation role').lean();
  if (staff) {
    const title = (staff.name || '').trim();
    // "Dean - School of Engineering" is a designation; "Chirag (HOD Test)" is a
    // person's name. A Staff name that doesn't read as a title is dropped in
    // favour of the designation field, which always does.
    const looksLikeTitle = /dean|hod|head|director|registrar|officer|incharge|in-charge|coordinator|warden|principal|controller|welfare/i.test(title);
    if (title && looksLikeTitle) return title;
    if (staff.designation) return staff.designation;
    return ROLE_LABELS[staff.role] || FALLBACK_LABEL;
  }

  const school = await School.findOne({
    $or: [{ deanEmail: clean }, { hodEmail: clean }],
  }).select('name deanEmail hodEmail').lean();

  if (school) {
    const isDean = (school.deanEmail || '').toLowerCase() === clean;
    return `${isDean ? 'Dean' : 'Head of Department'} — ${school.name}`;
  }

  return FALLBACK_LABEL;
};

/**
 * Label for a whole stage. Stages created before this field existed get one
 * resolved on the fly, so old requests render correctly in the app too.
 */
const labelForStage = async (stage) => {
  if (!stage) return FALLBACK_LABEL;
  if (stage.ownerLabel) return stage.ownerLabel;
  return resolveOwnerLabel((stage.recipientEmails || [])[0]);
};

module.exports = { resolveOwnerLabel, labelForStage, FALLBACK_LABEL };
