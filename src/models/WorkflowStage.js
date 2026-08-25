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

    // Written by the previous stage when forwarding, shown to this stage's owner.
    handoverNote: { type: String },
    handoverFrom: { type: String },

    // Escalation is resolved to real addresses when the stage is created, so the
    // sweeper never has to re-resolve tokens against the student's school.
    escalationRecipients: { type: [String], default: [] },
    escalateAfterHours: { type: Number },
    escalatedAt: { type: Date },
  },
  { timestamps: true }
);

workflowStageSchema.index({ request: 1, stageIndex: 1 });
// Supports the escalation sweeper's "pending, emailed, never escalated" scan.
workflowStageSchema.index({ status: 1, escalatedAt: 1, emailSentAt: 1 });

module.exports = mongoose.model('WorkflowStage', workflowStageSchema);
