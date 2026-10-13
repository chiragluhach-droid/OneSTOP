// Two kinds of desk hold a request, and they are held to different clocks.
//
//  intake    — the One Stop (DSW) desk. Every request lands here first, and its
//              only job is to triage, so it gets a short window.
//  forwarded — whoever the desk (or a later holder) passed it to: a dean, HOD,
//              director. They have to actually do the work, so they get longer.
//
// The stage records which kind it is, so the escalation sweeper never has to
// guess from the stage index and a reopened request restarts on the short clock.
const STAGE_KIND = {
  INTAKE: 'intake',
  FORWARDED: 'forwarded',
};

// Fallbacks only. The live values come from the admin-editable `escalation`
// setting — see settingController.DEFAULT_ESCALATION.
const DEFAULT_INTAKE_HOURS = 3;
const DEFAULT_FORWARDED_HOURS = 48;

/** How long this kind of stage has before it escalates. */
const slaHoursFor = (stageKind, escalationConfig = {}) => {
  const intake = escalationConfig.intakeHours || DEFAULT_INTAKE_HOURS;
  const forwarded =
    escalationConfig.forwardedHours
    // Older settings documents only had a single `afterHours` for every stage.
    || escalationConfig.afterHours
    || DEFAULT_FORWARDED_HOURS;

  return stageKind === STAGE_KIND.INTAKE ? intake : forwarded;
};

/**
 * Where the request sits after someone acts on it.
 *
 *   submitted                            → pending
 *   One Stop marks it in progress        → in_progress
 *   forwarded onward, by anyone          → in_review
 *   a forwarded desk marks it in progress → in_review  (already under review)
 *   anyone resolves                      → resolved
 *
 * `in_progress` means one specific thing: the One Stop desk is holding it and
 * working on it themselves. The moment it is passed to a dean, HOD or director
 * it becomes `in_review` and stays there until it is resolved — including when
 * that person forwards it on again, or acknowledges it.
 *
 * So the student can tell "the front desk has it" from "a department is on it"
 * without being shown anybody's mailbox.
 */
const nextRequestStatus = ({ stageKind, act }) => {
  if (act === 'resolved') return 'resolved';
  // Forwarding hands it to a department, whoever did the forwarding.
  if (act === 'forward') return 'in_review';
  // Acknowledgement: only the desk's own counts as "in progress".
  return stageKind === STAGE_KIND.INTAKE ? 'in_progress' : 'in_review';
};

module.exports = {
  STAGE_KIND,
  DEFAULT_INTAKE_HOURS,
  DEFAULT_FORWARDED_HOURS,
  slaHoursFor,
  nextRequestStatus,
};
