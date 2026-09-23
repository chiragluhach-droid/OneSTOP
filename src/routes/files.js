const express = require('express');
const { GetObjectCommand } = require('@aws-sdk/client-s3');
const s3 = require('../config/s3');
const { verify } = require('../utils/fileLinks');

const router = express.Router();

// Serves attachments linked from emails. Streams through the backend rather
// than redirecting to a presigned URL, so links in old emails never expire.
router.get('/', async (req, res) => {
  const key = String(req.query.key || '');
  const name = String(req.query.name || 'attachment');
  const sig = String(req.query.sig || '');

  if (!verify(key, name, sig)) {
    return res.status(404).type('text/plain').send('File not found.');
  }

  try {
    const obj = await s3.send(new GetObjectCommand({ Bucket: process.env.AWS_S3_BUCKET, Key: key }));

    // Strip anything that could break out of the header value.
    const safeName = name.replace(/["\r\n\\]/g, '_');
      const disposition = req.query.download === '1' ? 'attachment' : 'inline';
      res.set({
      'Content-Type': obj.ContentType || 'application/octet-stream',
      'Content-Disposition': `${disposition}; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    });
    if (obj.ContentLength) res.set('Content-Length', String(obj.ContentLength));

    obj.Body.on('error', () => res.destroy());
    obj.Body.pipe(res);
  } catch (err) {
    if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) {
      return res.status(404).type('text/plain').send('File not found.');
    }
    console.error('file download error:', err.message || err);
    return res.status(500).type('text/plain').send('Could not load this file. Please try again.');
  }
});

module.exports = router;
