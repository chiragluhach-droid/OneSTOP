const buildStudentNotificationEmail = ({ studentName, ticketId, status, remarks, stageName }) => {
  const statusConfig = {
    pending: { color: '#e67e22', label: 'Pending Review', icon: '⏳' },
    in_review: { color: '#3498db', label: 'Under Review', icon: '🔍' },
    approved_forwarded: { color: '#27ae60', label: 'Approved & Forwarded', icon: '✅' },
    rejected: { color: '#c0392b', label: 'Rejected', icon: '✗' },
    resolved: { color: '#1a7a3a', label: 'Resolved', icon: '🎉' },
  };

  const cfg = statusConfig[status] || statusConfig.pending;

  const remarksSection = remarks
    ? `<tr><td style="padding:16px 32px 0;">
        <p style="margin:0 0 8px;font-size:13px;color:#888;text-transform:uppercase;letter-spacing:1px;">Remarks</p>
        <div style="background:#f9f9f9;border:1px solid #eee;border-radius:6px;padding:14px;font-size:14px;color:#333;">${remarks}</div>
       </td></tr>`
    : '';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.1);">
        <tr>
          <td style="background:#8B1A1A;padding:24px 32px;">
            <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">OneSTOP</h1>
            <p style="margin:4px 0 0;color:#f5c6c6;font-size:13px;">Manav Rachna University — Request Update</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 0;">
            <p style="margin:0;font-size:16px;color:#222;">Hi <strong>${studentName}</strong>,</p>
            <p style="margin:10px 0 0;font-size:14px;color:#555;">Your request <strong>#${ticketId}</strong> has been updated.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;">
            <div style="background:${cfg.color};border-radius:8px;padding:20px;text-align:center;">
              <p style="margin:0;font-size:32px;">${cfg.icon}</p>
              <p style="margin:8px 0 0;font-size:18px;color:#fff;font-weight:700;">${cfg.label}</p>
              ${stageName ? `<p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.85);">Stage: ${stageName}</p>` : ''}
            </div>
          </td>
        </tr>
        ${remarksSection}
        <tr>
          <td style="padding:20px 32px 32px;">
            <p style="margin:0;font-size:13px;color:#888;">Open the OneSTOP app to view the full timeline of your request.</p>
          </td>
        </tr>
        <tr>
          <td style="background:#f8f8f8;padding:20px 32px;border-top:1px solid #eee;">
            <p style="margin:0;font-size:12px;color:#aaa;text-align:center;">
              OneSTOP — Manav Rachna University | Automated Workflow Platform
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

module.exports = { buildStudentNotificationEmail };
