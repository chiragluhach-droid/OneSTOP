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
 *   submitted                        → pending
 *   One Stop acts (in progress/fwd)  → in_progress
 *   a forwarded desk acts            → in_review
 *   anyone resolves                  → resolved
 *
 * So the student can tell "the desk has it" from "the dean is looking at it"
 * without being shown anybody's mailbox.
 */
const nextRequestStatus = ({ stageKind, act }) => {
  if (act === 'resolved') return 'resolved';
  return stageKind === STAGE_KIND.INTAKE ? 'in_progress' : 'in_review';
};

module.exports = {
  STAGE_KIND,
  DEFAULT_INTAKE_HOURS,
  DEFAULT_FORWARDED_HOURS,
  slaHoursFor,
  nextRequestStatus,
};
