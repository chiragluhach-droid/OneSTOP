const crypto = require('crypto');
const ApprovalToken = require('../models/ApprovalToken');
const WorkflowStage = require('../models/WorkflowStage');
const { sendEmail } = require('./emailService');
const { buildApprovalEmail } = require('../templates/approvalEmail');

const APPROVAL_EXPIRES_HOURS = parseInt(process.env.APPROVAL_TOKEN_EXPIRES_HOURS) || 72;

const generateToken = () => crypto.randomBytes(48).toString('hex');

const createApprovalToken = async ({ request, workflowStage, stageIndex, isFinalStage }) => {
  const expiresAt = new Date(Date.now() + APPROVAL_EXPIRES_HOURS * 60 * 60 * 1000);
  const token = generateToken();

  await ApprovalToken.create({
    token,
    request: request._id,
    workflowStage: workflowStage._id,
    stageIndex,
    isFinalStage,
    expiresAt,
  });

  return token;
};

const sendApprovalEmail = async ({ request, workflowStage, stageIndex, isFinalStage, student, category, school }) => {
  const approveToken = await createApprovalToken({ request, workflowStage, stageIndex, isFinalStage });

  let rejectToken = null;
  if (!isFinalStage) {
    rejectToken = await createApprovalToken({ request, workflowStage, stageIndex, isFinalStage: false });
  }

  const baseUrl = process.env.BACKEND_URL;
  const approveAction = isFinalStage ? 'approve_final' : 'approve_forward';
  const approveForwardUrl = `${baseUrl}/api/approvals/${approveToken}/action?act=${approveAction}`;
  const rejectUrl = rejectToken ? `${baseUrl}/api/approvals/${rejectToken}/action?act=reject` : null;

  const html = buildApprovalEmail({
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
    approveForwardUrl,
    rejectUrl,
    isFinalStage,
  });

  await sendEmail({
    to: workflowStage.recipientEmails,
    cc: workflowStage.ccEmails,
    subject: `[OneSTOP] Action Required — Ticket #${request.ticketId}`,
    htmlContent: html,
  });

  await WorkflowStage.findByIdAndUpdate(workflowStage._id, { emailSentAt: new Date() });
};

module.exports = { sendApprovalEmail, createApprovalToken };
