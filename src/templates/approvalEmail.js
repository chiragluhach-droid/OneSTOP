const buildApprovalEmail = ({
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
  resolvedUrl,
  forwardUrl,
  inProgressUrl,
  canForward,
  handoverNote,
}) => {
  const attachmentLinks =
    attachments && attachments.length > 0
      ? attachments.map((a) =>
          `<a href="${a.href || a.url}" style="color:#8B1A1A;margin-right:12px;" target="_blank">${a.originalName || 'Attachment'}</a>`
        ).join('')
      : '<span style="color:#888;">No attachments</span>';

  // A handover note written by the previous stage, shown before the details so
  // it is read before any action is taken.
  const handoverBlock = handoverNote
    ? `
        <tr>
          <td style="padding:20px 32px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#eef2ff;border-left:4px solid #1E3A8A;border-radius:6px;">
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0 0 6px;font-size:11px;color:#1E3A8A;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Note from One Stop Admin</p>
                  <p style="margin:0;font-size:14px;color:#333;line-height:1.6;">${handoverNote}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>`
    : '';

  const actionButtons = `
    ${inProgressUrl ? `
    <a href="${inProgressUrl}"
       style="display:inline-block;padding:13px 26px;background:#b45309;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;margin-right:10px;margin-bottom:10px;">
      ⏳ In Progress
    </a>` : ''}
    ${canForward && forwardUrl ? `
    <a href="${forwardUrl}"
       style="display:inline-block;padding:13px 26px;background:#1E3A8A;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;margin-right:10px;margin-bottom:10px;">
      → Forward
    </a>` : ''}
    <a href="${resolvedUrl}"
       style="display:inline-block;padding:13px 26px;background:#1a7a3a;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;margin-bottom:10px;">
      ✓ Resolve
    </a>`;

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
            <span style="background:#e67e22;color:#fff;padding:3px 10px;border-radius:12px;font-size:12px;">Action Required</span>
          </td>
        </tr>
        ${handoverBlock}
        <tr>
          <td style="padding:20px 32px 0;">
            <p style="margin:0;font-size:16px;color:#222;">Dear <strong>HOD / Dean / Director</strong>,</p>
            <p style="margin:10px 0 0;font-size:14px;color:#555;">
              A student request has been routed to you for action. Please review the details and take appropriate action using the buttons below.
            </p>
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
          <td style="padding:16px 32px 0;">
            <p style="margin:0 0 8px;font-size:13px;color:#888;text-transform:uppercase;letter-spacing:1px;">Attachments</p>
            <div style="font-size:13px;">${attachmentLinks}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;font-size:14px;color:#333;font-weight:700;">Take Action:</p>
            <div style="flex-wrap:wrap;">${actionButtons}</div>
          </td>
        </tr>
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

module.exports = { buildApprovalEmail };
