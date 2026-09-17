const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const s3 = require('../config/s3');

const objectUrl = (key) =>
  `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

/** Removes objects, ignoring individual failures (used for best-effort cleanup). */
const deleteFiles = async (attachments) => {
  await Promise.all(
    (attachments || [])
      .filter((a) => a?.publicId)
      .map((a) =>
        s3.send(new DeleteObjectCommand({ Bucket: process.env.AWS_S3_BUCKET, Key: a.publicId }))
          .catch(() => {})
      )
  );
};

/**
 * Uploads in-memory files (from actionUpload) under `prefix`, returning records
 * in the same shape as student attachments. All-or-nothing: if any upload
 * fails, the ones that succeeded are removed and the error is rethrown.
 */
const uploadFiles = async (files, prefix = 'onestop/resolutions') => {
  const uploaded = [];
  try {
    for (const file of files || []) {
      const key = `${prefix}/${uuidv4()}${path.extname(file.originalname || '').toLowerCase()}`;
      await s3.send(new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }));
      uploaded.push({
        url: objectUrl(key),
        publicId: key,
        originalName: file.originalname,
        mimeType: file.mimetype,
      });
    }
    return uploaded;
  } catch (err) {
    await deleteFiles(uploaded);
    throw err;
  }
};

module.exports = { uploadFiles, deleteFiles };
