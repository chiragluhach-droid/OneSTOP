const buildApprovalEmail = ({
  stageName,
  studentName,
  studentEmail,
  studentCollegeId,
  ticketId,
  category,
  school,
  subject,
  description,
  attachments,
  approveForwardUrl,
  rejectUrl,
  isFinalStage,
}) => {
  const attachmentLinks =
    attachments && attachments.length > 0
      ? attachments
          .map(
            (a) =>
              `<a href="${a.url}" style="color:#8B1A1A;margin-right:12px;" target="_blank">${a.originalName || 'Attachment'}</a>`
          )
          .join('')
      : '<span style="color:#888;">No attachments</span>';

  const actionButtons = isFinalStage
    ? `
    <a href="${approveForwardUrl}"
       style="display:inline-block;padding:14px 32px;background:#1a7a3a;color:#fff;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;margin-right:12px;">
      ✓ Approve &amp; Resolve
    </a>`
    : `
    <a href="${approveForwardUrl}"
       style="display:inline-block;padding:14px 32px;background:#1a7a3a;color:#fff;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;margin-right:12px;">
      ✓ Approve &amp; Forward
    </a>
    <a href="${rejectUrl}"
       style="display:inline-block;padding:14px 32px;background:#c0392b;color:#fff;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;">
      ✗ Reject
    </a>`;

  const stageLabel = isFinalStage
    ? '<span style="background:#8B1A1A;color:#fff;padding:3px 10px;border-radius:12px;font-size:12px;">Final Approver</span>'
    : '<span style="background:#e67e22;color:#fff;padding:3px 10px;border-radius:12px;font-size:12px;">Review &amp; Forward</span>';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.1);">
        <!-- Header -->
        <tr>
          <td style="background:#8B1A1A;padding:24px 32px;">
            <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">OneSTOP</h1>
            <p style="margin:4px 0 0;color:#f5c6c6;font-size:13px;">Manav Rachna University — Workflow Platform</p>
          </td>
        </tr>
        <!-- Stage Badge -->
        <tr>
          <td style="padding:16px 32px 0;">${stageLabel}</td>
        </tr>
        <!-- Greeting -->
        <tr>
          <td style="padding:20px 32px 0;">
            <p style="margin:0;font-size:16px;color:#222;">Dear <strong>${stageName} Team</strong>,</p>
            <p style="margin:10px 0 0;font-size:14px;color:#555;">
              A student request has been routed to you for action. Please review the details below and take appropriate action.
            </p>
          </td>
        </tr>
        <!-- Ticket Info -->
        <tr>
          <td style="padding:20px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fdf5f5;border-left:4px solid #8B1A1A;border-radius:6px;">
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0 0 8px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;">Ticket ID</p>
                  <p style="margin:0;font-size:20px;font-weight:700;color:#8B1A1A;">#${ticketId}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Details Grid -->
        <tr>
          <td style="padding:0 32px;">
            <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
              <tr style="background:#fafafa;">
                <td style="width:40%;color:#888;font-size:13px;border-bottom:1px solid #eee;padding:10px 12px;">Student Name</td>
                <td style="color:#222;font-size:13px;font-weight:600;border-bottom:1px solid #eee;padding:10px 12px;">${studentName}</td>
              </tr>
              <tr>
                <td style="color:#888;font-size:13px;border-bottom:1px solid #eee;padding:10px 12px;">College ID</td>
                <td style="color:#222;font-size:13px;font-weight:600;border-bottom:1px solid #eee;padding:10px 12px;">${studentCollegeId}</td>
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
        <!-- Description -->
        <tr>
          <td style="padding:20px 32px 0;">
            <p style="margin:0 0 8px;font-size:13px;color:#888;text-transform:uppercase;letter-spacing:1px;">Description</p>
            <div style="background:#f9f9f9;border:1px solid #eee;border-radius:6px;padding:16px;font-size:14px;color:#333;line-height:1.6;">
              ${description}
            </div>
          </td>
        </tr>
        <!-- Attachments -->
        <tr>
          <td style="padding:16px 32px 0;">
            <p style="margin:0 0 8px;font-size:13px;color:#888;text-transform:uppercase;letter-spacing:1px;">Attachments</p>
            <div style="font-size:13px;">${attachmentLinks}</div>
          </td>
        </tr>
        <!-- Action Buttons -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;font-size:14px;color:#555;font-weight:600;">Take Action:</p>
            <div>${actionButtons}</div>
            <p style="margin:20px 0 0;font-size:12px;color:#aaa;">
              These links will expire in 72 hours. Each link can only be used once.
              If you believe you received this by mistake, please ignore this email.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8f8f8;padding:20px 32px;border-top:1px solid #eee;">
            <p style="margin:0;font-size:12px;color:#aaa;text-align:center;">
              OneSTOP — Manav Rachna University | Automated Workflow Platform<br>
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
