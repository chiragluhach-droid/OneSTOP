const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    event: { type: String, required: true },
    actor: { type: String },
    // 'ProcessOwner' is a staff member acting through a one-time email link —
    // they have no account, so they are neither User nor Admin.
    actorModel: { type: String, enum: ['User', 'Admin', 'System', 'ProcessOwner'] },
    request: { type: mongoose.Schema.Types.ObjectId, ref: 'Request' },
    metadata: { type: mongoose.Schema.Types.Mixed },
    ipAddress: { type: String },
  },
  { timestamps: true }
);

auditLogSchema.index({ request: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
