const mongoose = require('mongoose');

// A record of every announcement an admin has sent. Kept because a broadcast
// cannot be recalled: once it has rung several thousand phones the only useful
// thing left is an accurate account of who it went to and who sent it.
const broadcastSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },

    audience: { type: String, enum: ['students', 'staff', 'both'], required: true },

    // The narrowing that was applied, exactly as submitted, so a past
    // broadcast can be explained or repeated.
    filters: {
      schoolIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'School' }],
      departments: [{ type: String }],
      staffRoles: [{ type: String }],
      studentEmails: [{ type: String }],
      staffEmails: [{ type: String }],
    },

    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
    sentByEmail: { type: String },

    // Outcome. `devices` can be far lower than `recipients` — plenty of people
    // have never opened the app or declined notifications — so the two are
    // reported separately rather than as one misleading number.
    recipients: { type: Number, default: 0 },
    recorded: { type: Number, default: 0 },
    devices: { type: Number, default: 0 },
    pushed: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },

    status: { type: String, enum: ['sent', 'partial', 'failed'], default: 'sent' },
    error: { type: String },
  },
  { timestamps: true }
);

broadcastSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Broadcast', broadcastSchema);
