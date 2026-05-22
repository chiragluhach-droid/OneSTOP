const crypto = require('crypto');

const generateApprovalToken = (requestId, stageIndex, teacherEmail) => {
  const payload = `${requestId}:${stageIndex}:${teacherEmail}:${Date.now()}`;
  const secret = process.env.APPROVAL_TOKEN_SECRET;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const signature = hmac.digest('hex');
  const raw = `${Buffer.from(payload).toString('base64url')}.${signature}`;
  return raw;
};

const verifyApprovalToken = (token, payload) => {
  const secret = process.env.APPROVAL_TOKEN_SECRET;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');
  const [, signature] = token.split('.');
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(signature)
  );
};

module.exports = { generateApprovalToken, verifyApprovalToken };
