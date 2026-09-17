// The S3 bucket is private, so a raw object URL returns 403 to anyone clicking
// it in an email. Emails instead link to /files on this backend, which streams
// the object back. Links are HMAC-signed over the key and filename, so only
// links this server generated are served — the endpoint can't be used to pull
// arbitrary objects out of the bucket.
const crypto = require('crypto');

// Only these prefixes are ever served.
const ALLOWED_PREFIXES = ['onestop/attachments/', 'onestop/resolutions/'];

const secret = () =>
  process.env.FILE_LINK_SECRET || process.env.APPROVAL_TOKEN_SECRET || process.env.JWT_ACCESS_SECRET;

const sign = (key, name) =>
  crypto.createHmac('sha256', secret()).update(`${key}\n${name}`).digest('base64url');

const isAllowedKey = (key) =>
  typeof key === 'string' &&
  !key.includes('..') &&
  ALLOWED_PREFIXES.some((p) => key.startsWith(p));

const verify = (key, name, sig) => {
  if (!isAllowedKey(key) || typeof sig !== 'string') return false;
  const expected = Buffer.from(sign(key, name));
  const given = Buffer.from(sig);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
};

/** Stable, signed URL for an attachment, safe to put in an email. */
const fileLink = (attachment) => {
  const key = attachment?.publicId;
  if (!isAllowedKey(key)) return attachment?.url || '#';
  const name = attachment.originalName || 'attachment';
  const base = process.env.BACKEND_URL || 'https://api.physiobook.in';
  const qs = new URLSearchParams({ key, name, sig: sign(key, name) });
  return `${base}/files?${qs.toString()}`;
};

/** Adds an `href` the templates can link to, keeping the stored fields intact. */
const withLinks = (attachments) =>
  (attachments || []).map((a) => {
    const plain = typeof a?.toObject === 'function' ? a.toObject() : { ...a };
    return { ...plain, href: fileLink(plain) };
  });

module.exports = { fileLink, withLinks, verify, isAllowedKey };
