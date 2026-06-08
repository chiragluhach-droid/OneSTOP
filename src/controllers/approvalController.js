const ApprovalToken = require('../models/ApprovalToken');
const ApprovalAction = require('../models/ApprovalAction');
const WorkflowStage = require('../models/WorkflowStage');
const Request = require('../models/Request');
const Category = require('../models/Category');
const School = require('../models/School');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendEmail } = require('../services/emailService');
const { sendApprovalEmail } = require('../services/workflowService');
const { buildStudentNotificationEmail } = require('../templates/studentNotificationEmail');
const auditLog = require('../utils/auditLogger');

const VALID_ACTIONS = ['forward', 'resolved', 'reject'];

const handleApprovalAction = async (req, res) => {
  const { token } = req.params;
  const act = req.query.act || req.body.act;

  if (!VALID_ACTIONS.includes(act)) {
    return res.status(400).send(buildResultPage('error', 'Invalid action.'));
  }

  try {
    const approvalToken = await ApprovalToken.findOne({ token })
      .populate('request')
      .populate('workflowStage');

    if (!approvalToken) {
      return res.status(404).send(buildResultPage('error', 'This link is invalid or does not exist.'));
    }

    if (approvalToken.isUsed) {
      return res.status(400).send(buildResultPage('error', 'This action link has already been used.'));
    }

    if (new Date() > approvalToken.expiresAt) {
      return res.status(400).send(buildResultPage('error', 'This link has expired. Please contact the student to resend.'));
    }

    const { request, workflowStage } = approvalToken;

    if (['resolved', 'rejected'].includes(request.status)) {
      return res.status(400).send(buildResultPage('error', 'This request has already been closed.'));
    }

    approvalToken.isUsed = true;
    approvalToken.usedAt = new Date();
    await approvalToken.save();

    const { remarks } = req.body;
    let stageStatus;
    let requestStatus;

    if (act === 'resolved') {
      stageStatus = 'approved_final';
      requestStatus = 'resolved';
    } else if (act === 'forward') {
      stageStatus = 'approved_forwarded';
      requestStatus = 'in_review';
    } else {
      stageStatus = 'rejected';
      requestStatus = 'rejected';
    }

    await WorkflowStage.findByIdAndUpdate(workflowStage._id, {
      status: stageStatus,
      actionTakenAt: new Date(),
      remarks: remarks || null,
    });

    await ApprovalAction.create({
      request: request._id,
      workflowStage: workflowStage._id,
      actorEmail: workflowStage.recipientEmails[0] || 'unknown',
      stageName: workflowStage.stageName,
      stageIndex: approvalToken.stageIndex,
      action: stageStatus,
      remarks: remarks || null,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    const updateData = { status: requestStatus };
    if (requestStatus === 'resolved') updateData.resolvedAt = new Date();
    if (requestStatus === 'rejected') {
      updateData.rejectedAt = new Date();
      updateData.rejectionReason = remarks;
    }
    if (act === 'forward') {
      updateData.currentStageIndex = approvalToken.stageIndex + 1;
    }
    await Request.findByIdAndUpdate(request._id, updateData);

    // Forward → send action email to next process owner
    if (act === 'forward') {
      const nextStageIndex = approvalToken.stageIndex + 1;
      const nextStage = await WorkflowStage.findOne({ request: request._id, stageIndex: nextStageIndex });

      if (nextStage) {
        const [student, category, school] = await Promise.all([
          User.findById(request.student),
          Category.findById(request.category),
          School.findById(request.school),
        ]);

        // canForward = there is yet another stage after the next one
        const stageAfterNext = await WorkflowStage.findOne({ request: request._id, stageIndex: nextStageIndex + 1 });
        const canForward = !!stageAfterNext;

        await sendApprovalEmail({
          request,
          workflowStage: nextStage,
          stageIndex: nextStage.stageIndex,
          canForward,
          student,
          category,
          school,
        });
      }
    }

    const student = await User.findById(request.student);

    const notifTitle =
      requestStatus === 'resolved' ? 'Request Resolved'
      : requestStatus === 'rejected' ? 'Request Rejected'
      : 'Request Forwarded';

    const notifBody =
      requestStatus === 'resolved'
        ? `Your request #${request.ticketId} has been resolved.`
        : requestStatus === 'rejected'
        ? `Your request #${request.ticketId} was rejected${remarks ? ': ' + remarks : '.'}`
        : `Your request #${request.ticketId} has been forwarded to the next process owner for review.`;

    await Notification.create({
      user: student._id,
      title: notifTitle,
      body: notifBody,
      type: requestStatus === 'resolved' ? 'request_resolved' : requestStatus === 'rejected' ? 'request_rejected' : 'stage_approved',
      request: request._id,
    });

    const studentEmailStatus = requestStatus === 'resolved' ? 'resolved' : requestStatus === 'rejected' ? 'rejected' : 'approved_forwarded';
    await sendEmail({
      to: student.email,
      toName: student.name,
      subject: `[OneSTOP] Your request #${request.ticketId} — ${notifTitle}`,
      htmlContent: buildStudentNotificationEmail({
        studentName: student.name,
        ticketId: request.ticketId,
        status: studentEmailStatus,
        remarks,
        stageName: workflowStage.stageName,
      }),
    });

    await auditLog({
      event: `APPROVAL_${stageStatus.toUpperCase()}`,
      actor: workflowStage.recipientEmails[0] || 'unknown',
      actorModel: 'ProcessOwner',
      request: request._id,
      metadata: { stageIndex: approvalToken.stageIndex, stageName: workflowStage.stageName, action: act, remarks },
      ipAddress: req.ip,
    });

    const successMessage =
      act === 'resolved'
        ? 'You have marked this request as Resolved. The student has been notified.'
        : act === 'forward'
        ? 'Request forwarded to the next process owner. The student has been notified.'
        : 'Request rejected. The student has been notified.';

    return res.status(200).send(buildResultPage('success', successMessage, request.ticketId, act));
  } catch (err) {
    console.error('handleApprovalAction error:', err);
    return res.status(500).send(buildResultPage('error', 'An internal error occurred. Please try again.'));
  }
};

const buildResultPage = (type, message, ticketId, action) => {
  const isSuccess = type === 'success';
  const icon = isSuccess ? '✓' : '✗';
  const color = isSuccess ? '#1a7a3a' : '#c0392b';
  const bgColor = isSuccess ? '#d5f5e3' : '#fde8e8';
  const actionLabel =
    action === 'resolved'
      ? 'Resolved'
      : action === 'forward'
      ? 'Forwarded'
      : 'Rejected';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>OneSTOP — Action Result</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;">
  <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">
    <div style="background:#8B1A1A;padding:24px 32px;">
      <h1 style="margin:0;color:#fff;font-size:20px;">OneSTOP</h1>
      <p style="margin:4px 0 0;color:#f5c6c6;font-size:13px;">Manav Rachna University</p>
    </div>
    <div style="padding:40px 32px;text-align:center;">
      <div style="width:72px;height:72px;background:${bgColor};border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:32px;color:${color};line-height:72px;">
        ${icon}
      </div>
      ${isSuccess && ticketId ? `<p style="margin:0 0 8px;font-size:13px;color:#888;">Ticket #${ticketId} — ${actionLabel}</p>` : ''}
      <p style="margin:0;font-size:16px;color:#333;line-height:1.6;">${message}</p>
    </div>
    <div style="background:#f8f8f8;padding:16px 32px;border-top:1px solid #eee;text-align:center;">
      <p style="margin:0;font-size:12px;color:#aaa;">You can close this tab.</p>
    </div>
  </div>
</body>
</html>`;
};

module.exports = { handleApprovalAction };
