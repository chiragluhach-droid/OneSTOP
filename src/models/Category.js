const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, trim: true },
    icon: { type: String, trim: true },
    // Entries may be plain emails or dynamic tokens (@dean / @hod) resolved
    // against the requesting student's school. See utils/recipients.js.
    processOwners: { type: [String], default: [] },
    ccEmails: { type: [String], default: [] },

    // If a stage sits untouched this long, nudge someone higher up.
    escalation: {
      enabled: { type: Boolean, default: false },
      afterHours: { type: Number, default: 48, min: 1 },
      recipients: { type: [String], default: ['@dean'] },
    },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Category', categorySchema);
