const crypto = require('crypto');
const ApprovalToken = require('../models/ApprovalToken');
const WorkflowStage = require('../models/WorkflowStage');
const { sendEmail } = require('./emailService');
const { buildApprovalEmail } = require('../templates/approvalEmail');
const { buildCCInfoEmail } = require('../templates/ccInfoEmail');

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

const sendApprovalEmail = async ({ request, workflowStage, stageIndex, canForward, student, category, school }) => {
  const baseUrl = process.env.BACKEND_URL;

  // Generate one token per action button
  const resolvedToken = await createApprovalToken({ request, workflowStage, stageIndex });
  const rejectToken   = await createApprovalToken({ request, workflowStage, stageIndex });
  const forwardToken  = canForward
    ? await createApprovalToken({ request, workflowStage, stageIndex })
    : null;

  const resolvedUrl = `${baseUrl}/api/approvals/${resolvedToken}/action?act=resolved`;
  const rejectUrl   = `${baseUrl}/api/approvals/${rejectToken}/action?act=reject`;
  const forwardUrl  = forwardToken ? `${baseUrl}/api/approvals/${forwardToken}/action?act=forward` : null;

  // Email WITH action buttons → process owner (To)
  const actionHtml = buildApprovalEmail({
    stageName: workflowStage.stageName,
    studentName: student.name,
    studentEmail: student.email,
    studentCollegeId: student.collegeId,
    ticketId: request.ticketId,
    category: category.name,
    school: school.name,
    subject: request.subject,
    description: request.description,
    attachments: request.attachments,
    resolvedUrl,
    rejectUrl,
    forwardUrl,
    canForward,
  });

  await sendEmail({
    to: workflowStage.recipientEmails,
    subject: `[OneSTOP] Action Required — Ticket #${request.ticketId}`,
    htmlContent: actionHtml,
  });

  // Separate informational email WITHOUT buttons → CC recipients
  if (workflowStage.ccEmails && workflowStage.ccEmails.length > 0) {
    const ccHtml = buildCCInfoEmail({
      stageName: workflowStage.stageName,
      studentName: student.name,
      studentEmail: student.email,
      studentCollegeId: student.collegeId,
      ticketId: request.ticketId,
      category: category.name,
      school: school.name,
      subject: request.subject,
      description: request.description,
      attachments: request.attachments,
      processOwnerEmail: workflowStage.recipientEmails[0],
    });

    await sendEmail({
      to: workflowStage.ccEmails,
      subject: `[OneSTOP] FYI — New Request Ticket #${request.ticketId}`,
      htmlContent: ccHtml,
    });
  }

  await WorkflowStage.findByIdAndUpdate(workflowStage._id, { emailSentAt: new Date() });
};

module.exports = { sendApprovalEmail, createApprovalToken };
