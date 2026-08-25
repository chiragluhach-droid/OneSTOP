const crypto = require('crypto');
const ApprovalToken = require('../models/ApprovalToken');
const WorkflowStage = require('../models/WorkflowStage');
const { sendEmail } = require('./emailService');
const { buildApprovalEmail } = require('../templates/approvalEmail');
const { buildCCInfoEmail } = require('../templates/ccInfoEmail');
const { buildEscalationEmail } = require('../templates/escalationEmail');
const { excludeEmail } = require('../utils/recipients');

const APPROVAL_EXPIRES_HOURS = parseInt(process.env.APPROVAL_TOKEN_EXPIRES_HOURS) || 72;

const generateToken = () => crypto.randomBytes(48).toString('hex');

const createApprovalToken = async ({ request, workflowStage, stageIndex }) => {
  const expiresAt = new Date(Date.now() + APPROVAL_EXPIRES_HOURS * 60 * 60 * 1000);
  const token = generateToken();
  await ApprovalToken.create({
    token,
    request: request._id,
    workflowStage: workflowStage._id,
    stageIndex,
    isFinalStage: false,
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
  attachments: request.attachments,
});

/**
 * FYI copy for the CC list. Sent for the initial routing and again on every
 * action, minus whoever took that action — they already know.
 */
const sendCcFyiEmail = async ({
  request, workflowStage, student, category, school, event = null, excludeActor = null,
}) => {
  // Anyone who already got a direct action email about this same event doesn't
  // also need an FYI copy of it — the same address is often both a process
  // owner and a CC recipient.
  const alreadyEmailed = [
    excludeActor,
    ...(workflowStage.recipientEmails || []),
    event?.nextOwnerEmail,
  ].filter(Boolean);

  const recipients = alreadyEmailed.reduce(
    (list, email) => excludeEmail(list, email),
    workflowStage.ccEmails || []
  );
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
  const forwardToken = canForward
    ? await createApprovalToken({ request, workflowStage, stageIndex })
    : null;

  const resolvedUrl = `${baseUrl}/api/approvals/${resolvedToken}/action?act=resolved`;
  const forwardUrl = forwardToken ? `${baseUrl}/api/approvals/${forwardToken}/action?act=forward` : null;

  await sendEmail({
    to: workflowStage.recipientEmails,
    subject: `[MR One] Action Required — Ticket #${request.ticketId}`,
    htmlContent: buildApprovalEmail({
      ...ticketFields({ request, student, category, school, workflowStage }),
      resolvedUrl,
      forwardUrl,
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

  await sendEmail({
    to: recipients,
    subject: `[MR One] Overdue ${hours}h — Ticket #${request.ticketId} awaiting action`,
    htmlContent: buildEscalationEmail({
      ...ticketFields({ request, student, category, school, workflowStage }),
      hours,
      pendingWith: (workflowStage.recipientEmails || []).join(', '),
      sentAt: workflowStage.emailSentAt,
    }),
  });

  return true;
};

module.exports = { sendApprovalEmail, sendCcFyiEmail, sendEscalationEmail, createApprovalToken };
