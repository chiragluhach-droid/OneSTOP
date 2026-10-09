const ApprovalToken = require('../models/ApprovalToken');
const WorkflowStage = require('../models/WorkflowStage');
const EscalationResponse = require('../models/EscalationResponse');
const Request = require('../models/Request');
const Category = require('../models/Category');
const School = require('../models/School');
const User = require('../models/User');
const { sendEmail } = require('../services/emailService');
const { buildEscalationResponseEmail } = require('../templates/escalationResponseEmail');
const { labelForStage } = require('../services/ownerIdentity');
const { withLinks } = require('../utils/fileLinks');
const { escapeHtml: esc } = require('../utils/htmlEscape');
const { INTAKE_EMAIL, INTAKE_LABEL } = require('../config/intake');
const { getEscalationConfig } = require('./settingController');
const { slaHoursFor } = require('../config/sla');
const auditLog = require('../utils/auditLogger');
const { notifyStaffByEmail } = require('../services/notifyService');

const VALID_ACTIONS = ['reply', 'forward'];

const MIN_MESSAGE_LENGTH = 5;

/**
 * Who a reply / forward goes to.
 *
 * Reply always lands on the One Stop desk — it is the desk's job to chase the
 * chain, so that is where a nudge belongs.
 *
 * Forward goes to whoever the escalation email named as holding the request. If
 * the desk is itself the one sitting on it, there is nobody further down the
 * chain yet, so both buttons land back on the desk and only the wording differs.
 */
const routeFor = ({ act, ownerEmail, isIntakeStage }) => {
  if (act === 'reply' || isIntakeStage || !ownerEmail) {
    return { to: [INTAKE_EMAIL], cc: [] };
  }
  return { to: [ownerEmail], cc: [INTAKE_EMAIL] };
};

const loadContext = async (token) => {
  const approvalToken = await ApprovalToken.findOne({ token, purpose: 'escalation' })
    .populate('request')
    .populate('workflowStage');

  if (!approvalToken) return { error: 'This link is invalid or does not exist.', status: 404 };
  if (approvalToken.isUsed) {
    return { error: 'This escalation form has been used the maximum number of times.', status: 400 };
  }
  if (new Date() > approvalToken.expiresAt) {
    return { error: 'This link has expired.', status: 400 };
  }

  const { request, workflowStage } = approvalToken;
  if (!request || !workflowStage) {
    return { error: 'The request this link refers to no longer exists.', status: 404 };
  }
  if (request.isDeleted) {
    return { error: 'This request has been withdrawn.', status: 400 };
  }

  const ownerEmail = (workflowStage.recipientEmails || [])[0] || null;
  const ownerLabel = await labelForStage(workflowStage);
  const isIntakeStage =
    workflowStage.stageKind === 'intake'
    || String(ownerEmail || '').toLowerCase() === INTAKE_EMAIL;

  return { approvalToken, request, workflowStage, ownerEmail, ownerLabel, isIntakeStage };
};

const buildRespondPage = ({
  token, ticketId, subject, description, studentName, stageName,
  ownerLabel, ownerEmail, isIntakeStage, overdueHours, errorMessage, previousMessage,
  alreadySent,
}) => {
  const forwardTarget = isIntakeStage ? INTAKE_LABEL : `${ownerLabel} (${ownerEmail})`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>MR One — Escalated Concern</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
    .card{max-width:560px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.12)}
    .hdr{background:#8B1A1A;padding:24px 28px}
    .hdr h1{color:#fff;font-size:20px;font-weight:700}
    .hdr p{color:#f5c6c6;font-size:13px;margin-top:4px}
    .badge-row{padding:20px 28px 0}
    .badge{display:inline-block;padding:6px 16px;border-radius:20px;font-size:13px;font-weight:600;color:#fff;background:#b45309}
    .alert{margin:16px 28px 0;background:#fef2f2;border-left:4px solid #dc2626;border-radius:8px;padding:14px 16px}
    .alert p{font-size:13px;color:#7f1d1d;line-height:1.6}
    .details{margin:16px 28px;background:#f8f9fa;border-radius:10px;padding:16px}
    .d-row{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid #eee}
    .d-row:last-child{border-bottom:none}
    .d-label{font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.5px;flex-shrink:0}
    .d-value{font-size:13px;color:#333;font-weight:600;text-align:right}
    .desc-box{margin:0 28px 16px}
    .desc-lbl{font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}
    .desc-txt{font-size:13px;color:#444;line-height:1.6;background:#f8f9fa;padding:12px;border-radius:8px;max-height:130px;overflow-y:auto}
    .form-section{padding:0 28px 26px}
    .f-label{font-size:14px;font-weight:600;color:#333;margin-bottom:6px}
    .f-hint{font-size:12px;color:#999;margin-bottom:8px;line-height:1.5}
    textarea{width:100%;min-height:130px;padding:14px;border:2px solid #e0e0e0;border-radius:10px;font-size:14px;font-family:inherit;resize:vertical;color:#333;background:#fafafa}
    textarea:focus{outline:none;border-color:#8B1A1A;background:#fff}
    .err-msg{background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:13px;color:#dc2626}
    .ok-msg{background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:13px;color:#047857}
    .btn-row{display:flex;gap:12px;margin-top:18px;flex-wrap:wrap}
    .btn{flex:1 1 180px;padding:15px 18px;color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;letter-spacing:.2px}
    .btn:hover{opacity:.9}
    .btn:disabled{opacity:.5;cursor:not-allowed}
    .btn-reply{background:#1E3A8A}
    .btn-fwd{background:#b45309}
    .route{margin-top:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px}
    .route p{font-size:12px;color:#475569;line-height:1.7}
    .route strong{color:#1e293b}
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
    <div class="badge-row"><span class="badge">Escalation · Overdue</span></div>
    <div class="alert">
      <p>This concern has <strong>not been resolved</strong> by <strong>${esc(ownerLabel)}</strong>${ownerEmail ? ` (${esc(ownerEmail)})` : ''}${overdueHours ? `, who was given ${esc(overdueHours)} hour${overdueHours === 1 ? '' : 's'} to act` : ''}.</p>
    </div>
    <div class="details">
      <div class="d-row"><span class="d-label">Ticket</span><span class="d-value">#${esc(ticketId)}</span></div>
      <div class="d-row"><span class="d-label">Student</span><span class="d-value">${esc(studentName || '—')}</span></div>
      <div class="d-row"><span class="d-label">Stage</span><span class="d-value">${esc(stageName || '—')}</span></div>
      <div class="d-row"><span class="d-label">Pending with</span><span class="d-value">${esc(ownerLabel)}</span></div>
    </div>
    <div class="desc-box">
      <div class="desc-lbl">Subject</div>
      <div class="desc-txt" style="margin-bottom:10px;"><strong>${esc(subject)}</strong></div>
      <div class="desc-lbl">Student's concern</div>
      <div class="desc-txt">${esc(description)}</div>
    </div>
    <form method="POST" class="form-section"
          onsubmit="var bs=this.querySelectorAll('button');for(var i=0;i<bs.length;i++)bs[i].disabled=true;">
      ${errorMessage ? `<div class="err-msg">${esc(errorMessage)}</div>` : ''}
      ${alreadySent ? `<div class="ok-msg">${esc(alreadySent)}</div>` : ''}
      <div class="f-label">Your message</div>
      <div class="f-hint">This is sent as written. It does not close the ticket — only the desk holding it can do that.</div>
      <textarea name="message" required placeholder="e.g. Please attend to this today and confirm back to the One Stop desk.">${esc(previousMessage || '')}</textarea>
      <div class="btn-row">
        <button type="submit" name="act" value="reply" class="btn btn-reply">↩ Reply to One Stop</button>
        <button type="submit" name="act" value="forward" class="btn btn-fwd">→ Forward${isIntakeStage ? '' : ' to ' + esc(ownerLabel)}</button>
      </div>
      <div class="route">
        <p><strong>Reply</strong> → ${esc(INTAKE_LABEL)} (${esc(INTAKE_EMAIL)})</p>
        <p><strong>Forward</strong> → ${esc(forwardTarget)}${isIntakeStage ? '' : ` · copied to ${esc(INTAKE_EMAIL)}`}</p>
        ${isIntakeStage ? `<p style="margin-top:6px;color:#64748b;">This request has not been passed on yet, so both options go to the One Stop desk.</p>` : ''}
      </div>
    </form>
    <div class="ftr"><p>You can come back to this link if you need to send another message.</p></div>
  </div>
</body>
</html>`;
};

const buildResultPage = (type, message, ticketId, detail) => {
  const ok = type === 'success';
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>MR One — ${ok ? 'Message Sent' : 'Error'}</title>
</head>
<body style="margin:0;padding:20px;background:#f4f4f4;font-family:Arial,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;">
  <div style="max-width:480px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);">
    <div style="background:#8B1A1A;padding:24px 32px;">
      <h1 style="margin:0;color:#fff;font-size:20px;">MR One</h1>
      <p style="margin:4px 0 0;color:#f5c6c6;font-size:13px;">Manav Rachna University</p>
    </div>
    <div style="padding:40px 32px;text-align:center;">
      <div style="width:72px;height:72px;background:${ok ? '#d5f5e3' : '#fde8e8'};border-radius:50%;margin:0 auto 20px;font-size:32px;color:${ok ? '#1a7a3a' : '#c0392b'};line-height:72px;">
        ${ok ? '✓' : '✗'}
      </div>
      ${ok && ticketId ? `<p style="margin:0 0 8px;font-size:13px;color:#888;">Ticket #${esc(ticketId)}</p>` : ''}
      <p style="margin:0;font-size:16px;color:#333;line-height:1.6;">${esc(message)}</p>
      ${detail ? `
      <div style="margin:24px 0 0;background:#f8fafc;border-radius:10px;padding:14px 18px;text-align:left;">
        <p style="margin:0;font-size:13px;color:#444;line-height:1.6;">${detail}</p>
      </div>` : ''}
    </div>
    <div style="background:#f8f8f8;padding:16px 32px;border-top:1px solid #eee;text-align:center;">
      <p style="margin:0;font-size:12px;color:#aaa;">You can close this tab.</p>
    </div>
  </div>
</body>
</html>`;
};

// GET /api/escalations/:token/respond
const showEscalationForm = async (req, res) => {
  try {
    const ctx = await loadContext(req.params.token);
    if (ctx.error) return res.status(ctx.status).send(buildResultPage('error', ctx.error));

    const { request, workflowStage, ownerEmail, ownerLabel, isIntakeStage } = ctx;
    const student = await User.findById(request.student).select('name').lean();

    const closed = ['resolved', 'rejected'].includes(request.status) || workflowStage.status !== 'pending';

    if (closed) {
      return res.status(200).send(
        buildResultPage(
          'success',
          'This concern has since been actioned, so there is nothing left to chase.',
          request.ticketId,
          `It is now marked <strong>${esc(request.status)}</strong>. No message is needed.`
        )
      );
    }

    return res.status(200).send(
      buildRespondPage({
        token: req.params.token,
        ticketId: request.ticketId,
        subject: request.subject,
        description: request.description,
        studentName: student?.name,
        stageName: workflowStage.stageName,
        ownerLabel,
        ownerEmail,
        isIntakeStage,
        overdueHours: workflowStage.escalateAfterHours,
        alreadySent: workflowStage.escalationResponseCount > 0
          ? `You have already sent ${workflowStage.escalationResponseCount} message${workflowStage.escalationResponseCount === 1 ? '' : 's'} about this concern.`
          : null,
      })
    );
  } catch (err) {
    console.error('showEscalationForm error:', err);
    return res.status(500).send(buildResultPage('error', 'An internal error occurred. Please try again.'));
  }
};

// POST /api/escalations/:token/respond
const handleEscalationResponse = async (req, res) => {
  try {
    const ctx = await loadContext(req.params.token);
    if (ctx.error) return res.status(ctx.status).send(buildResultPage('error', ctx.error));

    const { approvalToken, request, workflowStage, ownerEmail, ownerLabel, isIntakeStage } = ctx;

    const act = String(req.body.act || '').trim();
    const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
    const student = await User.findById(request.student);

    const reshow = (errorMessage) =>
      res.status(400).send(
        buildRespondPage({
          token: req.params.token,
          ticketId: request.ticketId,
          subject: request.subject,
          description: request.description,
          studentName: student?.name,
          stageName: workflowStage.stageName,
          ownerLabel,
          ownerEmail,
          isIntakeStage,
          overdueHours: workflowStage.escalateAfterHours,
          errorMessage,
          previousMessage: message,
        })
      );

    if (!VALID_ACTIONS.includes(act)) return reshow('Choose either Reply or Forward.');
    if (message.length < MIN_MESSAGE_LENGTH) return reshow('Please write a message before sending.');

    if (['resolved', 'rejected'].includes(request.status)) {
      return res.status(400).send(
        buildResultPage('error', 'This request has since been closed, so your message was not sent.', request.ticketId)
      );
    }

    const { to, cc } = routeFor({ act, ownerEmail, isIntakeStage });
    const targets = [...to, ...cc].filter(Boolean);
    if (!targets.length) return reshow('There is nobody to send this to. Please contact the One Stop desk.');

    const [category, school, escalationConfig] = await Promise.all([
      Category.findById(request.category),
      School.findById(request.school),
      getEscalationConfig(),
    ]);

    const authorEmail = (workflowStage.escalationRecipients || [])[0] || escalationConfig.recipientEmail || 'the escalation contact';
    const authorLabel = escalationConfig.recipientLabel || 'Escalation contact';

    const shared = {
      mode: act,
      authorLabel,
      authorEmail,
      message,
      ticketId: request.ticketId,
      stageName: workflowStage.stageName,
      studentName: student?.name || '—',
      studentEmail: student?.email || '—',
      studentRollNumber: student?.rollNumber || '—',
      category: category?.name || '—',
      school: school?.name || '—',
      subject: request.subject,
      description: request.description,
      attachments: withLinks(request.attachments),
      pendingWithLabel: ownerLabel,
      pendingWith: ownerEmail,
      // Stages created before the two-clock split carry no window of their own.
      hours: workflowStage.escalateAfterHours || slaHoursFor(
        workflowStage.stageKind || (workflowStage.stageIndex === 0 ? 'intake' : 'forwarded'),
        escalationConfig
      ),
    };

    const subjectLine = act === 'forward' && !isIntakeStage
      ? `[MR One] Escalated — please action Ticket #${request.ticketId}`
      : `[MR One] Escalation message — Ticket #${request.ticketId}`;

    await sendEmail({
      to,
      subject: subjectLine,
      htmlContent: buildEscalationResponseEmail(shared),
    });

    // The desk is copied on a forward, but a CC on an "action required" email
    // reads oddly — send it its own FYI-framed copy instead.
    if (cc.length) {
      await sendEmail({
        to: cc,
        subject: `[MR One] FYI — escalation message sent on Ticket #${request.ticketId}`,
        htmlContent: buildEscalationResponseEmail({ ...shared, isCopy: true }),
      });
    }

    await EscalationResponse.create({
      request: request._id,
      workflowStage: workflowStage._id,
      actorEmail: authorEmail,
      action: act,
      message,
      sentTo: to,
      ccTo: cc,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    await WorkflowStage.findByIdAndUpdate(workflowStage._id, {
      $set: { escalationResponseAt: new Date() },
      $inc: { escalationResponseCount: 1 },
    });

    // Ring the phone of everyone the message was addressed to. A senior nudge
    // that sits unread in an inbox achieves nothing.
    await Promise.all(
      [...to, ...cc].filter(Boolean).map((email) => notifyStaffByEmail(email, {
        title: act === 'forward' && !isIntakeStage
          ? `${authorLabel} — please action #${request.ticketId}`
          : `Message from ${authorLabel}`,
        body: message.slice(0, 180),
        type: 'escalation_message',
        request,
        channelId: 'escalations',
      }))
    ).catch((e) => console.warn('escalation message push failed:', e.message || e));

    await approvalToken.consume();

    await auditLog({
      event: `ESCALATION_${act.toUpperCase()}`,
      actor: authorEmail,
      actorModel: 'ProcessOwner',
      request: request._id,
      metadata: {
        stageIndex: workflowStage.stageIndex,
        stageName: workflowStage.stageName,
        sentTo: to,
        ccTo: cc,
      },
      ipAddress: req.ip,
    });

    const remaining = Math.max(0, (approvalToken.maxUses || 1) - (approvalToken.useCount || 0));

    return res.status(200).send(
      buildResultPage(
        'success',
        act === 'reply'
          ? `Your message has been sent to the ${INTAKE_LABEL}.`
          : isIntakeStage
            ? `Your message has been sent to the ${INTAKE_LABEL}.`
            : `Your message has been sent to ${ownerLabel}, with a copy to the One Stop desk.`,
        request.ticketId,
        `Sent to <strong>${to.map(esc).join(', ')}</strong>${cc.length ? ` · copied to <strong>${cc.map(esc).join(', ')}</strong>` : ''}.`
          + (remaining > 0 ? ` You can use this link ${remaining} more time${remaining === 1 ? '' : 's'} if you need to follow up.` : '')
      )
    );
  } catch (err) {
    console.error('handleEscalationResponse error:', err);
    return res.status(500).send(buildResultPage('error', 'An internal error occurred. Please try again.'));
  }
};

module.exports = { showEscalationForm, handleEscalationResponse };
