const mongoose = require('mongoose');

const workflowStageSchema = new mongoose.Schema(
  {
    request: { type: mongoose.Schema.Types.ObjectId, ref: 'Request', required: true },
    stageIndex: { type: Number, required: true },
    stageName: { type: String, required: true },
    recipientEmails: { type: [String], required: true },
    ccEmails: { type: [String], default: [] },
    status: {
      type: String,
      enum: ['pending', 'approved_forwarded', 'approved_final', 'rejected'],
      default: 'pending',
    },
    actionTakenAt: { type: Date },
    remarks: { type: String },
    emailSentAt: { type: Date },
  },
  { timestamps: true }
);

workflowStageSchema.index({ request: 1, stageIndex: 1 });

module.exports = mongoose.model('WorkflowStage', workflowStageSchema);
