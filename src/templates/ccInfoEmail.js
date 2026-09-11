// One read-only template for every FYI copy a CC recipient gets — the initial
// routing notice and each subsequent action on the ticket. `event` is null for
// the first copy and describes what happened for the rest.
const EVENT_STYLES = {
  forwarded:   { badge: 'Forwarded',   color: '#1E3A8A', tint: '#eef2ff', verb: 'forwarded this request' },
  in_progress: { badge: 'In Progress', color: '#b45309', tint: '#fef3c7', verb: 'has started working on this request' },
  resolved:  { badge: 'Resolved',   color: '#1a7a3a', tint: '#e8f6ec', verb: 'marked this request resolved' },
  rejected:  { badge: 'Rejected',   color: '#c0392b', tint: '#fdeceb', verb: 'rejected this request' },
  escalated: { badge: 'Escalated',  color: '#b45309', tint: '#fef3c7', verb: 'was escalated — no action was taken in time' },
};

const buildCCInfoEmail = ({
  stageName,
  studentName,
  studentEmail,
  studentRollNumber,
  ticketId,
  category,
  school,
  subject,
  description,
  attachments,
  processOwnerEmail,
  event = null,
}) => {
  const style = event ? EVENT_STYLES[event.type] : null;
  const accent = style ? style.color : '#475569';

  const attachmentLinks =
    attachments && attachments.length > 0
      ? attachments.map((a) =>
          `<a href="${a.url}" style="color:#8B1A1A;margin-right:12px;" target="_blank">${a.originalName || 'Attachment'}</a>`
        ).join('')
      : '<span style="color:#888;">No attachments</span>';

  const headline = style
    ? `
        <tr>
          <td style="padding:20px 32px 0;">
            <p style="margin:0;font-size:15px;color:#222;">
              <strong>${event.actorEmail || 'A process owner'}</strong> ${style.verb}.
            </p>
            ${event.nextOwnerEmail ? `
            <p style="margin:10px 0 0;font-size:14px;color:#555;">
              It is now with <strong>${event.nextOwnerEmail}</strong> for action.
            </p>` : ''}
            <p style="margin:10px 0 0;font-size:14px;color:#555;">
              This is an informational copy — no action is required from you.
            </p>
            ${event.remarks ? `
            <div style="margin:16px 0 0;background:${style.tint};border-left:4px solid ${accent};border-radius:6px;padding:14px 16px;">
              <p style="margin:0 0 6px;font-size:11px;color:#666;text-transform:uppercase;letter-spacing:1px;">Remarks</p>
              <p style="margin:0;font-size:14px;color:#333;line-height:1.6;">${event.remarks}</p>
            </div>` : ''}
          </td>
        </tr>`
    : `
        <tr>
          <td style="padding:20px 32px 0;">
            <p style="margin:0;font-size:15px;color:#222;">This is an <strong>informational copy</strong> of a student request.</p>
            <p style="margin:10px 0 0;font-size:14px;color:#555;">
              The request has been routed to <strong>${processOwnerEmail}</strong> for action.
              No action is required from you on this email.
            </p>
          </td>
        </tr>`;

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
            <span style="background:${accent};color:#fff;padding:3px 10px;border-radius:12px;font-size:12px;">
              ${style ? style.badge + ' · FYI' : 'For Your Information (CC)'}
            </span>
          </td>
        </tr>
        ${headline}
        <tr>
          <td style="padding:20px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border-left:4px solid ${accent};border-radius:6px;">
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0 0 4px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;">Ticket ID</p>
                  <p style="margin:0;font-size:22px;font-weight:700;color:${accent};">#${ticketId}</p>
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
                <td style="color:#888;font-size:13px;border-bottom:1px solid #eee;padding:10px 12px;">Subject</td>
                <td style="color:#222;font-size:13px;font-weight:600;border-bottom:1px solid #eee;padding:10px 12px;">${subject}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 0;">
            <p style="margin:0 0 8px;font-size:13px;color:#888;text-transform:uppercase;letter-spacing:1px;">Description</p>
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
        <tr>
          <td style="background:#f8f8f8;padding:20px 32px;border-top:1px solid #eee;">
            <p style="margin:0;font-size:12px;color:#aaa;text-align:center;">
              MR One — Manav Rachna University<br>
              This is an automated informational copy. No action needed.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

module.exports = { buildCCInfoEmail };
