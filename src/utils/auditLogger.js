const AuditLog = require('../models/AuditLog');

const auditLog = async ({ event, actor, actorModel, request, metadata, ipAddress }) => {
  try {
    await AuditLog.create({ event, actor, actorModel, request, metadata, ipAddress });
  } catch (err) {
    console.error('Audit log error:', err.message);
  }
};

module.exports = auditLog;
