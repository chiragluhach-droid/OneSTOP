const mongoose = require('mongoose');
const pushTokenSchema = require('./pushTokenSchema');

const staffSchema = new mongoose.Schema(
  {
    name:          { type: String, required: true, trim: true },
    email:         { type: String, required: true, unique: true, lowercase: true, trim: true },
    designation:   { type: String, trim: true },
    role:          { type: String, enum: ['dsw', 'dean', 'hod', 'staff'], default: 'staff' },
    isActive:      { type: Boolean, default: true },
    otp:           { type: String },
    otpExpiresAt:  { type: Date },
    otpAttempts:   { type: Number, default: 0 },
    lastOtpSentAt: { type: Date },
    refreshToken:  { type: String },
    // See the note on User: `expoPushToken` stays for older builds,
    // `pushTokens` is the list the sender actually reads.
    expoPushToken: { type: String },
    pushTokens: { type: [pushTokenSchema], default: [] },
  },
  { timestamps: true }
);

// `email` already has a unique index from its field definition above; declaring
// it again here is what produced Mongoose's "Duplicate schema index" warning.

module.exports = mongoose.model('Staff', staffSchema);
