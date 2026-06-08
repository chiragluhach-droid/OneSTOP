const mongoose = require('mongoose');

const approvalTokenSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true },
    request: { type: mongoose.Schema.Types.ObjectId, ref: 'Request', required: true },
    workflowStage: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkflowStage', required: true },
    stageIndex: { type: Number, required: true },
    isFinalStage: { type: Boolean, default: false },
    isUsed: { type: Boolean, default: false },
    usedAt: { type: Date },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

approvalTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
approvalTokenSchema.index({ request: 1 });

module.exports = mongoose.model('ApprovalToken', approvalTokenSchema);
