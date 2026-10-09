// Carries a message written by the escalation contact after a concern went
// unactioned. Two shapes:
//
//   reply   → to the One Stop desk. "Your desk let this sit; here is what I say."
//   forward → to whoever is currently holding the stage, One Stop copied.
//
// No action buttons: the holder's original Resolve / Forward / In Progress
// links are still live and remain the only way to move the ticket.
const buildEscalationResponseEmail = ({
  mode,
  authorLabel,
  authorEmail,
  message,
  ticketId,
  stageName,
  studentName,
  studentEmail,
  studentRollNumber,
  category,
  school,
  subject,
  description,
  attachments,
  pendingWithLabel,
  pendingWith,
  hours,
  isCopy,
}) => {
  const isForward = mode === 'forward';

  const attachmentLinks =
    attachments && attachments.length > 0
      ? attachments.map((a) =>
          `<a href="${a.href || a.url}" style="color:#8B1A1A;margin-right:12px;" target="_blank">${a.originalName || 'Attachment'}</a>`
        ).join('')
      : '<span style="color:#888;">No attachments</span>';

  const heading = isForward
    ? 'Action required — escalated to you'
    : 'Message from the escalation contact';

  const lede = isCopy
    ? `For your information: <strong>${authorLabel}</strong> has written to ${pendingWithLabel || 'the desk holding this request'} about this overdue concern.`
    : isForward
      ? `This concern is still open with you after <strong>${hours} hour${hours === 1 ? '' : 's'}</strong>. <strong>${authorLabel}</strong> has asked that it be dealt with.`
      : `<strong>${authorLabel}</strong> was notified that this concern went unactioned and has sent the following message to the One Stop desk.`;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.1);">
        <tr>
          <td style="background:#8B1A1A;padding:24px 32px;">
            <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">MR One</h1>
            <p style="margin:4px 0 0;color:#f5c6c6;font-size:13px;">Manav Rachna University</p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 0;">
            <span style="background:${isCopy ? '#64748b' : isForward ? '#dc2626' : '#1E3A8A'};color:#fff;padding:3px 10px;border-radius:12px;font-size:12px;">
              ${isCopy ? 'FYI · Escalation' : isForward ? 'Escalation · Action Required' : 'Escalation · Reply'}
            </span>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 0;">
            <p style="margin:0;font-size:16px;color:#222;font-weight:700;">${heading}</p>
            <p style="margin:10px 0 0;font-size:14px;color:#555;line-height:1.6;">${lede}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#eef2ff;border-left:4px solid #1E3A8A;border-radius:6px;">
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0 0 6px;font-size:11px;color:#1E3A8A;text-transform:uppercase;letter-spacing:1px;font-weight:700;">
                    Message from ${authorLabel}
                  </p>
                  <p style="margin:0;font-size:14px;color:#333;line-height:1.7;white-space:pre-wrap;">${message}</p>
                  <p style="margin:12px 0 0;font-size:12px;color:#64748b;">— ${authorEmail}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fdf5f5;border-left:4px solid #8B1A1A;border-radius:6px;">
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0 0 4px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;">Ticket ID</p>
                  <p style="margin:0;font-size:22px;font-weight:700;color:#8B1A1A;">#${ticketId}</p>
                  <p style="margin:4px 0 0;font-size:12px;color:#888;">${stageName}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px;">
            <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
              <tr style="background:#fafafa;">
                <td style="width:40%;color:#888;font-size:13px;border-bottom:1px solid #eee;padding:10px 12px;">Student Name</td>
                <td style="color:#222;font-size:13px;font-weight:600;border-bottom:1px solid #eee;padding:10px 12px;">${studentName}</td>
              </tr>
              <tr>
                <td style="color:#888;font-size:13px;border-bottom:1px solid #eee;padding:10px 12px;">Roll Number</td>
                <td style="color:#222;font-size:13px;font-weight:600;border-bottom:1px solid #eee;padding:10px 12px;">${studentRollNumber}</td>
              </tr>
              <tr style="background:#fafafa;">
                <td style="color:#888;font-size:13px;border-bottom:1px solid #eee;padding:10px 12px;">Email</td>
                <td style="color:#222;font-size:13px;border-bottom:1px solid #eee;padding:10px 12px;">${studentEmail}</td>
              </tr>
              <tr>
                <td style="color:#888;font-size:13px;border-bottom:1px solid #eee;padding:10px 12px;">Category</td>
                <td style="color:#222;font-size:13px;font-weight:600;border-bottom:1px solid #eee;padding:10px 12px;">${category}</td>
              </tr>
              <tr style="background:#fafafa;">
                <td style="color:#888;font-size:13px;border-bottom:1px solid #eee;padding:10px 12px;">School</td>
                <td style="color:#222;font-size:13px;font-weight:600;border-bottom:1px solid #eee;padding:10px 12px;">${school}</td>
              </tr>
              <tr>
                <td style="color:#888;font-size:13px;border-bottom:1px solid #eee;padding:10px 12px;">Pending With</td>
                <td style="color:#dc2626;font-size:13px;font-weight:600;border-bottom:1px solid #eee;padding:10px 12px;">
                  ${pendingWithLabel ? `${pendingWithLabel} (${pendingWith || '—'})` : (pendingWith || '—')}
                </td>
              </tr>
              <tr style="background:#fafafa;">
                <td style="color:#888;font-size:13px;border-bottom:1px solid #eee;padding:10px 12px;">Subject</td>
                <td style="color:#222;font-size:13px;font-weight:600;border-bottom:1px solid #eee;padding:10px 12px;">${subject}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 0;">
            <p style="margin:0 0 8px;font-size:13px;color:#888;text-transform:uppercase;letter-spacing:1px;">Student's concern</p>
            <div style="background:#f9f9f9;border:1px solid #eee;border-radius:6px;padding:16px;font-size:14px;color:#333;line-height:1.6;">
              ${description}
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 24px;">
            <p style="margin:0 0 8px;font-size:13px;color:#888;text-transform:uppercase;letter-spacing:1px;">Attachments</p>
            <div style="font-size:13px;">${attachmentLinks}</div>
          </td>
        </tr>
        ${isForward && !isCopy ? `
        <tr>
          <td style="padding:0 32px 24px;">
            <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:14px 18px;">
              <p style="margin:0;font-size:13px;color:#9a3412;line-height:1.6;">
                Your <strong>In Progress</strong>, <strong>Forward</strong> and <strong>Resolve</strong> links
                from the original request email are still active — use any of them to move this ticket.
              </p>
            </div>
          </td>
        </tr>` : ''}
        <tr>
          <td style="background:#f8f8f8;padding:20px 32px;border-top:1px solid #eee;">
            <p style="margin:0;font-size:12px;color:#aaa;text-align:center;">
              MR One — Manav Rachna University<br>
              Do not reply to this email directly.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

module.exports = { buildEscalationResponseEmail };
