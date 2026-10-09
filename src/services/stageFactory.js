const WorkflowStage = require('../models/WorkflowStage');
const Request = require('../models/Request');
const { INTAKE_EMAIL, INTAKE_LABEL } = require('../config/intake');
const { STAGE_KIND, slaHoursFor } = require('../config/sla');
const { resolveOwnerLabel } = require('./ownerIdentity');
const { getEscalationConfig } = require('../controllers/settingController');

/**
 * Escalation contact + window for a stage of the given kind.
 *
 * The admin-configured contact wins. When escalation is switched off, or no
 * contact is set, the stage inherits whatever the previous stage carried, so a
 * chain already in flight keeps whatever it started with.
 */
const escalationFor = async (stageKind, inheritFrom = null) => {
  const config = await getEscalationConfig();

  if (config.enabled && config.recipientEmail) {
    return {
      escalationRecipients: [config.recipientEmail],
      escalateAfterHours: slaHoursFor(stageKind, config),
    };
  }

  return {
    escalationRecipients: inheritFrom?.escalationRecipients || [],
    escalateAfterHours: inheritFrom?.escalateAfterHours,
  };
};

/**
 * The first stage of a brand-new request: the One Stop desk, on the short clock.
 */
const createIntakeStage = async ({ request, category, ccEmails = [], stageIndex = 0, isReopen = false }) => {
  const esc = await escalationFor(STAGE_KIND.INTAKE);

  return WorkflowStage.create({
    request: request._id,
    stageIndex,
    stageName: isReopen
      ? `Reopened — ${category.name}`
      : `${INTAKE_LABEL} — ${category.name}`,
    recipientEmails: [INTAKE_EMAIL],
    ccEmails,
    stageKind: STAGE_KIND.INTAKE,
    ownerLabel: INTAKE_LABEL,
    isReopen,
    status: 'pending',
    ...esc,
  });
};

/**
 * The next hop when someone forwards. The chain has no predefined length: each
 * holder decides where it goes next, and every hop after intake runs on the
 * longer clock because that person has to do the actual work.
 */
const createForwardStage = async ({ request, fromStage, forwardTo, handoverNote, actorEmail, category }) => {
  const stageIndex = fromStage.stageIndex + 1;
  const esc = await escalationFor(STAGE_KIND.FORWARDED, fromStage);
  const ownerLabel = await resolveOwnerLabel(forwardTo);

  const stage = await WorkflowStage.create({
    request: request._id,
    stageIndex,
    stageName: `Forwarded — ${category.name}`,
    recipientEmails: [forwardTo],
    // The FYI list follows the request down the chain.
    ccEmails: fromStage.ccEmails || [],
    stageKind: STAGE_KIND.FORWARDED,
    ownerLabel,
    handoverNote: handoverNote || undefined,
    handoverFrom: handoverNote ? actorEmail : undefined,
    status: 'pending',
    ...esc,
  });

  await Request.findByIdAndUpdate(request._id, {
    totalStages: Math.max(request.totalStages || 1, stageIndex + 1),
  });

  return stage;
};

module.exports = { createIntakeStage, createForwardStage, escalationFor };
