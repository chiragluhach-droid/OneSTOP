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
    // Marking a stage 'in progress' acknowledges it without closing it — the
    // status stays 'pending' so Resolve / Forward remain available.
    inProgressAt: { type: Date },
    inProgressNote: { type: String },

    actionTakenAt: { type: Date },
    remarks: { type: String },
    emailSentAt: { type: Date },

    // Written by the previous stage when forwarding, shown to this stage's owner.
    handoverNote: { type: String },
    handoverFrom: { type: String },

    // Files attached by the staff member when resolving, sent to the student.
    attachments: { type: [{
      url: { type: String, required: true },
      publicId: { type: String },
      originalName: { type: String },
      mimeType: { type: String },
      _id: false,
    }], default: [] },

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
