const mongoose = require('mongoose');

const workflowStageSchema = new mongoose.Schema(
  {
    request: { type: mongoose.Schema.Types.ObjectId, ref: 'Request', required: true },
    stageIndex: { type: Number, required: true },
    stageName: { type: String, required: true },
    recipientEmails: { type: [String], required: true },
    ccEmails: { type: [String], default: [] },

    // Which clock this stage runs on, and how the request reads to the student
    // while it sits here. See config/sla.js.
    stageKind: { type: String, enum: ['intake', 'forwarded'], default: 'forwarded' },

    // Designation of whoever holds this stage ("Dean — School of Law"). The
    // student-facing API sends this instead of recipientEmails.
    ownerLabel: { type: String },
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

    // Set when the escalation contact replies or pushes the stage back. Shown
    // on the stage so the next person to open the ticket sees the nudge.
    escalationResponseAt: { type: Date },
    escalationResponseCount: { type: Number, default: 0 },

    // Set when a student reopens a request: the new stage that carries their
    // follow-up, so the app can label it "Reopened" rather than "Forwarded".
    isReopen: { type: Boolean, default: false },
  },
  { timestamps: true }
);

workflowStageSchema.index({ request: 1, stageIndex: 1 });
// Supports the escalation sweeper's "pending, emailed, never escalated" scan.
workflowStageSchema.index({ status: 1, escalatedAt: 1, emailSentAt: 1 });

module.exports = mongoose.model('WorkflowStage', workflowStageSchema);
