const { escapeHtml } = require('../utils/htmlEscape');

// The automatic reply the One Stop desk sends the moment a concern arrives, so
// a student knows their mail landed and who is holding it, rather than waiting
// in silence for the first human reply.

const APP_LINK =
  process.env.APP_DEEP_LINK ||
  `${process.env.BACKEND_URL || 'https://api.physiobook.in'}/open/track`;

const buildAcknowledgementEmail = ({
  studentName, ticketId, subject, categoryName, message, respondBy, deskLabel,
}) => {
  const name = escapeHtml(studentName);
  const ticket = escapeHtml(ticketId);
  const subj = escapeHtml(subject);
  const category = escapeHtml(categoryName);
  const body = escapeHtml(message).replace(/\n/g, '<br>');
  const desk = escapeHtml(deskLabel);

  const respondBySection = respondBy
    ? `<tr><td style="padding:4px 32px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff7ed;border-left:4px solid #b45309;border-radius:6px;">
          <tr><td style="padding:14px 18px;">
            <p style="margin:0 0 4px;font-size:11px;color:#b45309;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Expected response by</p>
            <p style="margin:0;font-size:15px;color:#333;font-weight:700;">${escapeHtml(respondBy)}</p>
            <p style="margin:6px 0 0;font-size:12px;color:#666;">Weekends and university holidays are not counted.</p>
          </td></tr>
        </table>
       </td></tr>`
    : '';

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
          <td style="padding:28px 32px 0;">
            <p style="margin:0;font-size:16px;color:#222;">Hi <strong>${name}</strong>,</p>
            <p style="margin:10px 0 0;font-size:14px;color:#555;">${body}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;">
            <div style="background:#b45309;border-radius:8px;padding:20px;text-align:center;">
              <p style="margin:0;font-size:32px;">&#9203;</p>
              <p style="margin:8px 0 0;font-size:18px;color:#fff;font-weight:700;">In Progress</p>
              <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.85);">With the ${desk}</p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:4px 32px 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:8px;">
              <tr><td style="padding:14px 18px;">
                <p style="margin:0 0 4px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Your reference number</p>
                <p style="margin:0 0 12px;font-size:18px;color:#8B1A1A;font-weight:700;">#${ticket}</p>
                <p style="margin:0 0 4px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Concern</p>
                <p style="margin:0;font-size:14px;color:#333;">${subj}</p>
                <p style="margin:6px 0 0;font-size:12px;color:#666;">${category}</p>
              </td></tr>
            </table>
          </td>
        </tr>
        ${respondBySection}
        <tr>
          <td style="padding:24px 32px 32px;" align="center">
            <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr>
                <td style="border-radius:999px;background:#8B1A1A;box-shadow:0 2px 8px rgba(139,26,26,0.28);">
                  <a href="${APP_LINK}"
                     style="display:inline-block;padding:14px 34px;border-radius:999px;color:#ffffff;
                            text-decoration:none;font-size:15px;font-weight:700;letter-spacing:0.3px;">
                    Track in MR One &nbsp;&rsaquo;
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:14px 0 0;font-size:12px;color:#aaa;">
              This is an automatic acknowledgement — there is no need to reply.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f8f8f8;padding:20px 32px;border-top:1px solid #eee;">
            <p style="margin:0;font-size:12px;color:#aaa;text-align:center;">
              MR One — Manav Rachna University
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

module.exports = { buildAcknowledgementEmail };
