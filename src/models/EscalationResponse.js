const mongoose = require('mongoose');

// What the escalation contact did after being told a concern had gone unactioned.
// Kept separate from ApprovalAction: this never changes the state of the request,
// it only puts pressure on whoever is sitting on it.
const escalationResponseSchema = new mongoose.Schema(
  {
    request: { type: mongoose.Schema.Types.ObjectId, ref: 'Request', required: true },
    workflowStage: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkflowStage', required: true },

    // Whoever was configured as the escalation contact at the time.
    actorEmail: { type: String, required: true },

    // reply   — back to the One Stop desk
    // forward — on to the desk currently holding the stage, One Stop copied
    action: { type: String, enum: ['reply', 'forward'], required: true },

    message: { type: String, required: true },
    sentTo: { type: [String], default: [] },
    ccTo: { type: [String], default: [] },

    ipAddress: { type: String },
    userAgent: { type: String },
  },
  { timestamps: true }
);

escalationResponseSchema.index({ request: 1, createdAt: -1 });

module.exports = mongoose.model('EscalationResponse', escalationResponseSchema);
