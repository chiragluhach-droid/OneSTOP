const mongoose = require('mongoose');

const approvalActionSchema = new mongoose.Schema(
  {
    request: { type: mongoose.Schema.Types.ObjectId, ref: 'Request', required: true },
    workflowStage: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkflowStage', required: true },
    actorEmail: { type: String, required: true },
    stageName: { type: String },
    stageIndex: { type: Number, required: true },
    action: {
      type: String,
      enum: ['approved_forwarded', 'approved_final', 'in_progress', 'rejected'],
      required: true,
    },
    remarks: { type: String },
    handoverNote: { type: String },
    ipAddress: { type: String },
    userAgent: { type: String },
  },
  { timestamps: true }
);

approvalActionSchema.index({ request: 1 });

module.exports = mongoose.model('ApprovalAction', approvalActionSchema);
