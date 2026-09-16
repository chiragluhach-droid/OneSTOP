const ApprovalToken = require('../models/ApprovalToken');
const ApprovalAction = require('../models/ApprovalAction');
const WorkflowStage = require('../models/WorkflowStage');
const Request = require('../models/Request');
const Category = require('../models/Category');
const School = require('../models/School');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendEmail } = require('../services/emailService');
const { sendApprovalEmail, sendCcFyiEmail } = require('../services/workflowService');
const { buildStudentNotificationEmail } = require('../templates/studentNotificationEmail');
const auditLog = require('../utils/auditLogger');
const { isEmail } = require('../utils/recipients');

// Reject was removed — a process owner closes a request with Resolve and
// explains why in their message to the student.
const VALID_ACTIONS = ['forward', 'resolved', 'in_progress'];

// 'in_progress' is an acknowledgement, not an outcome: it reassures the student
// and leaves the stage open so Resolve / Forward still work afterwards.
const ACKNOWLEDGEMENT_ACTIONS = ['in_progress'];

const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const ACTION_META = {
  resolved: {
    title: 'Resolve Request',
    button: '✓ Confirm Resolve',
    color: '#1a7a3a',
    badge: 'Resolving',
    intro: 'This closes the request and notifies the student with your message.',
    remarksLabel: 'Message to student',
    remarksHint: 'Explain how it was resolved — or, if it cannot be done, why. The student sees this.',
    remarksRequired: true,
  },
  in_progress: {
    title: 'Mark In Progress',
    button: '⏳ Confirm — Notify Student',
    color: '#b45309',
    badge: 'In Progress',
    intro: 'This tells the student you have started working on it. The request stays open and assigned to you.',
    remarksLabel: 'Message to student',
    remarksHint: 'Optional — add context or a rough timeline. Leave blank to send the standard update.',
    remarksRequired: false,
  },
  forward: {
    title: 'Forward Request',
    button: '→ Confirm Forward',
    color: '#1E3A8A',
    badge: 'Forwarding',
    intro: 'Send this request to whoever should handle it. They get the same options you have, and can forward it onwards themselves.',
    forwardToLabel: 'Forward to',
    forwardToHint: 'Any university email address. They receive the full request with their own action links.',
    remarksLabel: 'Note to student',
    remarksHint: 'Optional — tell the student why it is being forwarded. The student is told who it went to.',
    remarksRequired: false,
    handoverLabel: 'Note to that person',
    handoverHint: 'Optional — what you already did, and what they need to do. The student does not see this.',
  },
};

const buildFormPage = ({ act, token, ticketId, subject, description, studentName, categoryName, stageName, errorMessage, previousRemarks, previousHandover, previousForwardTo }) => {
  const meta = ACTION_META[act];
  const required = meta.remarksRequired ? '<span style="color:#c0392b;"> *</span>' : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>MR One — ${esc(meta.title)}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
    .card{max-width:540px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.12)}
    .hdr{background:#8B1A1A;padding:24px 28px}
    .hdr h1{color:#fff;font-size:20px;font-weight:700}
    .hdr p{color:#f5c6c6;font-size:13px;margin-top:4px}
    .badge-row{padding:20px 28px 0}
    .badge{display:inline-block;padding:6px 16px;border-radius:20px;font-size:13px;font-weight:600;color:#fff;background:${meta.color}}
    .intro{padding:12px 28px 0;font-size:14px;color:#666;line-height:1.5}
    .details{margin:16px 28px;background:#f8f9fa;border-radius:10px;padding:16px}
    .d-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee}
    .d-row:last-child{border-bottom:none}
    .d-label{font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.5px}
    .d-value{font-size:13px;color:#333;font-weight:600;text-align:right;max-width:60%}
    .desc-box{margin:0 28px 16px}
    .desc-lbl{font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}
    .desc-txt{font-size:13px;color:#444;line-height:1.6;background:#f8f9fa;padding:12px;border-radius:8px;max-height:120px;overflow-y:auto}
    .form-section{padding:0 28px 24px}
    .f-label{font-size:14px;font-weight:600;color:#333;margin-bottom:8px}
    .f-hint{font-size:12px;color:#999;margin-bottom:8px}
    textarea{width:100%;min-height:110px;padding:14px;border:2px solid #e0e0e0;border-radius:10px;font-size:14px;font-family:inherit;resize:vertical;transition:border-color .2s;color:#333;background:#fafafa}
    textarea:focus{outline:none;border-color:${meta.color};background:#fff}
    .f-input{width:100%;padding:14px;border:2px solid #e0e0e0;border-radius:10px;font-size:15px;
             font-family:inherit;color:#333;background:#fafafa}
    .f-input:focus{outline:none;border-color:${meta.color};background:#fff}
    .divider{margin:22px 0 18px;border-top:1px dashed #dcdcdc}
    .handover{margin-top:22px;padding-top:20px;border-top:1px dashed #dcdcdc}
    .err-msg{background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:13px;color:#dc2626}
    .submit-btn{display:block;width:100%;padding:16px;background:${meta.color};color:#fff;border:none;border-radius:10px;font-size:16px;font-weight:700;cursor:pointer;transition:opacity .2s;font-family:inherit;margin-top:16px;letter-spacing:.3px}
    .submit-btn:hover{opacity:.9}
    .submit-btn:disabled{opacity:.5;cursor:not-allowed}
    .ftr{background:#f8f8f8;padding:16px 28px;border-top:1px solid #eee;text-align:center}
    .ftr p{font-size:12px;color:#aaa}
  </style>
</head>
<body>
  <div class="card">
    <div class="hdr">
      <h1>MR One</h1>
      <p>Manav Rachna University</p>
    </div>
    <div class="badge-row"><span class="badge">${esc(meta.badge)}</span></div>
    <p class="intro">${esc(meta.intro)}</p>
    <div class="details">
      <div class="d-row"><span class="d-label">Ticket</span><span class="d-value">#${esc(ticketId)}</span></div>
      <div class="d-row"><span class="d-label">Student</span><span class="d-value">${esc(studentName || '—')}</span></div>
      <div class="d-row"><span class="d-label">Category</span><span class="d-value">${esc(categoryName || '—')}</span></div>
      <div class="d-row"><span class="d-label">Stage</span><span class="d-value">${esc(stageName || '—')}</span></div>
    </div>
    <div class="desc-box">
      <div class="desc-lbl">Subject</div>
      <div class="desc-txt" style="margin-bottom:10px;"><strong>${esc(subject)}</strong></div>
      <div class="desc-lbl">Description</div>
      <div class="desc-txt">${esc(description)}</div>
    </div>
    <form method="POST" action="?act=${act}" class="form-section" onsubmit="this.querySelector('button').disabled=true;this.querySelector('button').textContent='Submitting…';">
      ${errorMessage ? `<div class="err-msg">${esc(errorMessage)}</div>` : ''}
      ${meta.forwardToLabel ? `
      <div class="f-label">${esc(meta.forwardToLabel)}<span style="color:#c0392b;"> *</span></div>
      <div class="f-hint">${esc(meta.forwardToHint)}</div>
      <input class="f-input" type="email" name="forwardTo" required
             placeholder="name@mru.edu.in" value="${esc(previousForwardTo || '')}"
             autocapitalize="off" autocorrect="off" spellcheck="false">
      <div class="divider"></div>` : ''}
      <div class="f-label">${esc(meta.remarksLabel)}${required}</div>
      <div class="f-hint">${esc(meta.remarksHint)}</div>
      <textarea name="remarks" placeholder="Type your message here...">${esc(previousRemarks || '')}</textarea>
      ${meta.handoverLabel ? `
      <div class="handover">
        <div class="f-label">${esc(meta.handoverLabel)}</div>
        <div class="f-hint">${esc(meta.handoverHint)}</div>
        <textarea name="handoverNote" placeholder="e.g. I have verified the documents — please approve the fee waiver.">${esc(previousHandover || '')}</textarea>
      </div>` : ''}
      <input type="hidden" name="act" value="${act}">
      <button type="submit" class="submit-btn">${esc(meta.button)}</button>
    </form>
    <div class="ftr"><p>You can close this tab after submitting.</p></div>
  </div>
</body>
</html>`;
};

const showApprovalForm = async (req, res) => {
  const { token } = req.params;
  const act = req.query.act;

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

    const [student, category] = await Promise.all([
      User.findById(request.student),
      Category.findById(request.category),
    ]);

    return res.status(200).send(
      buildFormPage({
        act,
        token,
        ticketId: request.ticketId,
        subject: request.subject,
        description: request.description,
        studentName: student?.name,
        categoryName: category?.name,
        stageName: workflowStage.stageName,
      })
    );
  } catch (err) {
    console.error('showApprovalForm error:', err);
    return res.status(500).send(buildResultPage('error', 'An internal error occurred. Please try again.'));
  }
};

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

    const remarks = typeof req.body.remarks === 'string' ? req.body.remarks.trim() : '';
    const handoverNote = typeof req.body.handoverNote === 'string' ? req.body.handoverNote.trim() : '';
    const forwardTo = typeof req.body.forwardTo === 'string'
      ? req.body.forwardTo.trim().toLowerCase()
      : '';

    const actorEmailEarly = (workflowStage.recipientEmails || [])[0] || null;

    // Work out what's wrong before touching the token, so a fixable mistake
    // doesn't burn a single-use link.
    let validationError = null;
    if (ACTION_META[act].remarksRequired && !remarks) {
      validationError = `${ACTION_META[act].remarksLabel} is required.`;
    } else if (act === 'forward') {
      const studentEmail = (await User.findById(request.student).select('email').lean())?.email || '';
      if (!forwardTo) {
        validationError = 'Enter the email address to forward this request to.';
      } else if (!isEmail(forwardTo)) {
        validationError = `"${forwardTo}" is not a valid email address.`;
      } else if (actorEmailEarly && forwardTo === actorEmailEarly.toLowerCase()) {
        validationError = 'That is your own address — forward it to someone else.';
      } else if (studentEmail && forwardTo === studentEmail.toLowerCase()) {
        validationError = 'That is the student\'s own address. Use Resolve to reply to them instead.';
      }
    }

    if (validationError) {
      const [student, category] = await Promise.all([
        User.findById(request.student),
        Category.findById(request.category),
      ]);
      return res.status(400).send(
        buildFormPage({
          act,
          token,
          ticketId: request.ticketId,
          subject: request.subject,
          description: request.description,
          studentName: student?.name,
          categoryName: category?.name,
          stageName: workflowStage.stageName,
          errorMessage: validationError,
          previousRemarks: remarks,
          previousHandover: handoverNote,
          previousForwardTo: forwardTo,
        })
      );
    }

    // Only consume the token after validation passes
    approvalToken.isUsed = true;
    approvalToken.usedAt = new Date();
    await approvalToken.save();

    // ── Acknowledgement: reassure the student, keep the stage open ──
    // Only this link is consumed. The stage stays 'pending' and its Resolve /
    // Forward links stay valid, so the owner can still act on it afterwards.
    if (ACKNOWLEDGEMENT_ACTIONS.includes(act)) {
      // A stage that has already been resolved or forwarded must not be dragged
      // back to "in progress" by an older link still sitting in someone's inbox.
      if (workflowStage.status !== 'pending') {
        return res.status(400).send(
          buildResultPage('error', 'This stage has already been actioned, so it can no longer be marked in progress.')
        );
      }

      const now = new Date();

      // Saved to `remarks` rather than a dedicated field: every mobile build ever
      // shipped renders stage.remarks on the timeline, whereas a new field would
      // need an app update before students could see it. The prefix keeps it
      // readable in older builds, which still label a pending stage "Awaiting".
      await WorkflowStage.findByIdAndUpdate(workflowStage._id, {
        inProgressAt: now,
        remarks: remarks
          ? `In progress — ${remarks}`
          : 'In progress — being worked on, will be resolved soon.',
      });
      await Request.findByIdAndUpdate(request._id, {
        status: 'in_progress',
        inProgressAt: now,
      });

      const [student, category, school] = await Promise.all([
        User.findById(request.student),
        Category.findById(request.category),
        School.findById(request.school),
      ]);

      const actorEmail = workflowStage.recipientEmails[0] || null;

      await ApprovalAction.create({
        request: request._id,
        workflowStage: workflowStage._id,
        actorEmail: actorEmail || 'unknown',
        stageName: workflowStage.stageName,
        stageIndex: approvalToken.stageIndex,
        action: 'in_progress',
        remarks: remarks || null,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      await Notification.create({
        user: student._id,
        title: 'Request In Progress',
        body: `Your request #${request.ticketId} is being worked on and will be resolved soon.${remarks ? ' ' + remarks : ''}`,
        type: 'request_in_progress',
        request: request._id,
      });

      await sendEmail({
        to: student.email,
        subject: `[MR One] Your request #${request.ticketId} — In Progress`,
        htmlContent: buildStudentNotificationEmail({
          studentName: student.name,
          ticketId: request.ticketId,
          status: 'in_progress',
          remarks,
          stageName: workflowStage.stageName,
        }),
      });

      await sendCcFyiEmail({
        request,
        workflowStage,
        student,
        category,
        school,
        excludeActor: actorEmail,
        event: { type: 'in_progress', subjectLabel: 'In Progress', actorEmail, remarks, nextOwnerEmail: null },
      });

      await auditLog({
        event: 'APPROVAL_IN_PROGRESS',
        actor: actorEmail || 'unknown',
        actorModel: 'ProcessOwner',
        request: request._id,
        metadata: { stageIndex: approvalToken.stageIndex, stageName: workflowStage.stageName, remarks },
        ipAddress: req.ip,
      });

      const hasNextStage = Boolean(
        await WorkflowStage.findOne({
          request: request._id,
          stageIndex: approvalToken.stageIndex + 1,
        })
      );

      return res.status(200).send(
        buildResultPage(
          'success',
          `${student.name} has been told their request is in progress and will be resolved soon.`,
          request.ticketId,
          act,
          `<strong>This request is still open and assigned to you.</strong> `
            + `When you are ready, use the <strong>Resolve</strong>`
            + (hasNextStage ? ' or <strong>Forward</strong>' : '')
            + ` link in the original email. Those links still work.`
        )
      );
    }
    let stageStatus;
    let requestStatus;

    if (act === 'resolved') {
      stageStatus = 'approved_final';
      requestStatus = 'resolved';
    } else {
      stageStatus = 'approved_forwarded';
      requestStatus = 'in_progress';
    }

    await WorkflowStage.findByIdAndUpdate(workflowStage._id, {
      status: stageStatus,
      actionTakenAt: new Date(),
      remarks: remarks || workflowStage.remarks || null,
    });

    await ApprovalAction.create({
      request: request._id,
      workflowStage: workflowStage._id,
      actorEmail: workflowStage.recipientEmails[0] || 'unknown',
      stageName: workflowStage.stageName,
      stageIndex: approvalToken.stageIndex,
      action: stageStatus,
      remarks: remarks || null,
      handoverNote: handoverNote || null,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    const updateData = { status: requestStatus };
    if (requestStatus === 'resolved') updateData.resolvedAt = new Date();
    if (act === 'forward') {
      updateData.currentStageIndex = approvalToken.stageIndex + 1;
    }
    await Request.findByIdAndUpdate(request._id, updateData);

    const actorEmail = workflowStage.recipientEmails[0] || null;

    const [student, category, school] = await Promise.all([
      User.findById(request.student),
      Category.findById(request.category),
      School.findById(request.school),
    ]);

    // Forward → append a brand new stage for whoever was named on the form.
    // The chain has no predefined length: each hop is decided by the person
    // currently holding the request, and they can forward onwards in turn.
    let nextOwnerEmail = null;
    if (act === 'forward') {
      const nextStageIndex = approvalToken.stageIndex + 1;
      nextOwnerEmail = forwardTo;

      const nextStage = await WorkflowStage.create({
        request: request._id,
        stageIndex: nextStageIndex,
        stageName: `Forwarded — ${category.name}`,
        recipientEmails: [forwardTo],
        // The FYI list and escalation window follow the request down the chain.
        ccEmails: workflowStage.ccEmails || [],
        escalationRecipients: workflowStage.escalationRecipients || [],
        escalateAfterHours: workflowStage.escalateAfterHours,
        handoverNote: handoverNote || undefined,
        handoverFrom: handoverNote ? actorEmail : undefined,
        status: 'pending',
      });

      await Request.findByIdAndUpdate(request._id, {
        totalStages: Math.max(request.totalStages || 1, nextStageIndex + 1),
      });

      await sendApprovalEmail({
        request,
        workflowStage: nextStage,
        stageIndex: nextStage.stageIndex,
        canForward: true, // whoever holds it may always pass it on
        student,
        category,
        school,
        handoverNote,
      });
    }

    // FYI copy of this action to the CC list, minus whoever just actioned it.
    const EVENT_BY_ACTION = {
      forward: { type: 'forwarded', subjectLabel: 'Forwarded' },
      resolved: { type: 'resolved', subjectLabel: 'Resolved' },
    };

    await sendCcFyiEmail({
      request,
      workflowStage,
      student,
      category,
      school,
      excludeActor: actorEmail,
      event: { ...EVENT_BY_ACTION[act], actorEmail, remarks, nextOwnerEmail },
    });

    const notifTitle = requestStatus === 'resolved' ? 'Request Resolved' : 'Request Forwarded';

    const notifBody =
      requestStatus === 'resolved'
        ? `Your request #${request.ticketId} has been resolved.${remarks ? ' ' + remarks : ''}`
        : `Your request #${request.ticketId} has been forwarded to ${nextOwnerEmail} for review.${remarks ? ' ' + remarks : ''}`;

    await Notification.create({
      user: student._id,
      title: notifTitle,
      body: notifBody,
      type: requestStatus === 'resolved' ? 'request_resolved' : 'stage_approved',
      request: request._id,
    });

    const studentEmailStatus = requestStatus === 'resolved' ? 'resolved' : 'approved_forwarded';
    await sendEmail({
      to: student.email,
      toName: student.name,
      subject: `[MR One] Your request #${request.ticketId} — ${notifTitle}`,
      htmlContent: buildStudentNotificationEmail({
        studentName: student.name,
        ticketId: request.ticketId,
        status: studentEmailStatus,
        remarks,
        stageName: workflowStage.stageName,
        forwardedTo: nextOwnerEmail,
      }),
    });

    await auditLog({
      event: `APPROVAL_${stageStatus.toUpperCase()}`,
      actor: workflowStage.recipientEmails[0] || 'unknown',
      actorModel: 'ProcessOwner',
      request: request._id,
      metadata: { stageIndex: approvalToken.stageIndex, stageName: workflowStage.stageName, action: act, remarks, forwardedTo: nextOwnerEmail || undefined },
      ipAddress: req.ip,
    });

    const successMessage =
      act === 'resolved'
        ? 'You have marked this request as Resolved. The student has been notified.'
        : `Request forwarded to ${nextOwnerEmail}. They have been emailed, and the student has been told who it went to.`;

    return res.status(200).send(buildResultPage('success', successMessage, request.ticketId, act));
  } catch (err) {
    console.error('handleApprovalAction error:', err);
    return res.status(500).send(buildResultPage('error', 'An internal error occurred. Please try again.'));
  }
};

const buildResultPage = (type, message, ticketId, action, footnote) => {
  const isSuccess = type === 'success';
  // In Progress is a success, but not a closure — amber keeps it visually
  // distinct from the green "this ticket is done" pages.
  const acknowledged = isSuccess && action === 'in_progress';

  const icon = !isSuccess ? '✗' : acknowledged ? '⏳' : '✓';
  const color = !isSuccess ? '#c0392b' : acknowledged ? '#b45309' : '#1a7a3a';
  const bgColor = !isSuccess ? '#fde8e8' : acknowledged ? '#fef3c7' : '#d5f5e3';
  const actionLabel =
    action === 'resolved' ? 'Resolved'
    : action === 'in_progress' ? 'In Progress'
    : 'Forwarded';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>MR One — Action Result</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;">
  <div style="max-width:480px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">
    <div style="background:#8B1A1A;padding:24px 32px;">
      <h1 style="margin:0;color:#fff;font-size:20px;">MR One</h1>
      <p style="margin:4px 0 0;color:#f5c6c6;font-size:13px;">Manav Rachna University</p>
    </div>
    <div style="padding:40px 32px;text-align:center;">
      <div style="width:72px;height:72px;background:${bgColor};border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:32px;color:${color};line-height:72px;">
        ${icon}
      </div>
      ${isSuccess && ticketId ? `<p style="margin:0 0 8px;font-size:13px;color:#888;">Ticket #${ticketId} — ${actionLabel}</p>` : ''}
      <p style="margin:0;font-size:16px;color:#333;line-height:1.6;">${message}</p>
      ${footnote ? `
      <div style="margin:24px 0 0;background:${bgColor};border-radius:10px;padding:14px 18px;text-align:left;">
        <p style="margin:0;font-size:13px;color:#444;line-height:1.6;">${footnote}</p>
      </div>` : ''}
    </div>
    <div style="background:#f8f8f8;padding:16px 32px;border-top:1px solid #eee;text-align:center;">
      <p style="margin:0;font-size:12px;color:#aaa;">You can close this tab.</p>
    </div>
  </div>
</body>
</html>`;
};

module.exports = { handleApprovalAction, showApprovalForm };
