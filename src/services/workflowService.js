const crypto = require('crypto');
const ApprovalToken = require('../models/ApprovalToken');
const WorkflowStage = require('../models/WorkflowStage');
const { sendEmail } = require('./emailService');
const { buildApprovalEmail } = require('../templates/approvalEmail');
const { buildCCInfoEmail } = require('../templates/ccInfoEmail');
const { buildEscalationEmail } = require('../templates/escalationEmail');
const { excludeEmail } = require('../utils/recipients');
const { INTAKE_EMAIL } = require('../config/intake');
const { withLinks } = require('../utils/fileLinks');
const { labelForStage } = require('./ownerIdentity');

const APPROVAL_EXPIRES_HOURS = parseInt(process.env.APPROVAL_TOKEN_EXPIRES_HOURS) || 72;

// The escalation response form stays open longer than an action link, and can
// be used more than once — see the comment on ApprovalToken.purpose.
const ESCALATION_RESPONSE_EXPIRES_HOURS = parseInt(process.env.ESCALATION_RESPONSE_EXPIRES_HOURS) || 336;
const ESCALATION_RESPONSE_MAX_USES = parseInt(process.env.ESCALATION_RESPONSE_MAX_USES) || 10;

const generateToken = () => crypto.randomBytes(48).toString('hex');

const createApprovalToken = async ({
  request, workflowStage, stageIndex,
  purpose = 'action', maxUses = 1, expiresHours = APPROVAL_EXPIRES_HOURS,
}) => {
  const expiresAt = new Date(Date.now() + expiresHours * 60 * 60 * 1000);
  const token = generateToken();
  await ApprovalToken.create({
    token,
    request: request._id,
    workflowStage: workflowStage._id,
    stageIndex,
    isFinalStage: false,
    purpose,
    maxUses,
    expiresAt,
  });
  return token;
};

/** Shared ticket fields every template needs. */
const ticketFields = ({ request, student, category, school, workflowStage }) => ({
  stageName: workflowStage.stageName,
  studentName: student.name,
  studentEmail: student.email,
  studentRollNumber: student.rollNumber,
  ticketId: request.ticketId,
  category: category.name,
  school: school.name,
  subject: request.subject,
  description: request.description,
  attachments: withLinks(request.attachments),
});

/**
 * Read-only update about the request. Two kinds of recipient:
 *
 *  - the intake desk, so it stays informed about anything a forwarded person
 *    does to a request it passed on. When the desk itself is the actor it is
 *    filtered out below, so it never gets an FYI about its own action.
 *  - any extra addresses the category lists in ccEmails (normally none).
 *
 * Anyone who already received a direct action email about this same event is
 * removed, so nobody is told the same thing twice.
 */
const sendCcFyiEmail = async ({
  request, workflowStage, student, category, school, event = null, excludeActor = null,
}) => {
  const alreadyEmailed = [
    excludeActor,
    ...(workflowStage.recipientEmails || []),
    event?.nextOwnerEmail,
  ].filter(Boolean);

  const audience = [INTAKE_EMAIL, ...(workflowStage.ccEmails || [])];
  const deduped = audience.filter(
    (email, i) => audience.findIndex((e) => e.toLowerCase() === email.toLowerCase()) === i
  );

  const recipients = alreadyEmailed.reduce((list, email) => excludeEmail(list, email), deduped);
  if (recipients.length === 0) return;

  const subjectLine = event
    ? `[MR One] ${event.subjectLabel} — Ticket #${request.ticketId}`
    : `[MR One] FYI — New Request Ticket #${request.ticketId}`;

  await sendEmail({
    to: recipients,
    subject: subjectLine,
    htmlContent: buildCCInfoEmail({
      ...ticketFields({ request, student, category, school, workflowStage }),
      processOwnerEmail: (workflowStage.recipientEmails || [])[0],
      event,
    }),
  });
};

const sendApprovalEmail = async ({
  request, workflowStage, stageIndex, canForward, student, category, school, handoverNote = null,
}) => {
  const baseUrl = process.env.BACKEND_URL;

  // One single-use token per action button.
  const resolvedToken = await createApprovalToken({ request, workflowStage, stageIndex });
  const inProgressToken = await createApprovalToken({ request, workflowStage, stageIndex });
  const forwardToken = canForward
    ? await createApprovalToken({ request, workflowStage, stageIndex })
    : null;

  const resolvedUrl = `${baseUrl}/api/approvals/${resolvedToken}/action?act=resolved`;
  const inProgressUrl = `${baseUrl}/api/approvals/${inProgressToken}/action?act=in_progress`;
  const forwardUrl = forwardToken ? `${baseUrl}/api/approvals/${forwardToken}/action?act=forward` : null;

  await sendEmail({
    to: workflowStage.recipientEmails,
    subject: `[MR One] Action Required — Ticket #${request.ticketId}`,
    htmlContent: buildApprovalEmail({
      ...ticketFields({ request, student, category, school, workflowStage }),
      resolvedUrl,
      forwardUrl,
      inProgressUrl,
      canForward,
      handoverNote: handoverNote || workflowStage.handoverNote,
    }),
  });

  await WorkflowStage.findByIdAndUpdate(workflowStage._id, { emailSentAt: new Date() });
};

/**
 * Nudge sent when a stage has sat untouched past its escalation window. The
 * original action links stay valid — this only widens who knows about it.
 */
const sendEscalationEmail = async ({ request, workflowStage, student, category, school, hours }) => {
  const recipients = excludeEmail(
    workflowStage.escalationRecipients || [],
    (workflowStage.recipientEmails || [])[0]
  );
  if (recipients.length === 0) return false;

  const ownerEmail = (workflowStage.recipientEmails || [])[0];
  const ownerLabel = await labelForStage(workflowStage);

  // A longer life than an action link: an escalation is read by someone senior
  // who may not open their inbox for a day or two, and the window the stage
  // already blew through is the shorter of the two clocks.
  const respondToken = await createApprovalToken({
    request,
    workflowStage,
    stageIndex: workflowStage.stageIndex,
    purpose: 'escalation',
    maxUses: ESCALATION_RESPONSE_MAX_USES,
    expiresHours: ESCALATION_RESPONSE_EXPIRES_HOURS,
  });

  // Forward goes to whoever is named in the message. When the desk itself is
  // the one sitting on it, there is nobody further down the chain yet, so both
  // buttons land back on the desk.
  const isIntakeStage =
    workflowStage.stageKind === 'intake'
    || String(ownerEmail || '').toLowerCase() === INTAKE_EMAIL;

  await sendEmail({
    to: recipients,
    subject: `[MR One] Overdue ${hours}h — Ticket #${request.ticketId} awaiting action`,
    htmlContent: buildEscalationEmail({
      ...ticketFields({ request, student, category, school, workflowStage }),
      hours,
      pendingWith: (workflowStage.recipientEmails || []).join(', '),
      pendingWithLabel: ownerLabel,
      sentAt: workflowStage.emailSentAt,
      respondUrl: `${process.env.BACKEND_URL}/api/escalations/${respondToken}/respond`,
      forwardTargetLabel: isIntakeStage
        ? 'the One Stop desk'
        : `${ownerLabel} (${ownerEmail})`,
    }),
  });

  return true;
};

module.exports = { sendApprovalEmail, sendCcFyiEmail, sendEscalationEmail, createApprovalToken };
