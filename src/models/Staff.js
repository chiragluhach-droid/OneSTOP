const mongoose = require('mongoose');

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
    expoPushToken: { type: String },
  },
  { timestamps: true }
);

staffSchema.index({ email: 1 });

module.exports = mongoose.model('Staff', staffSchema);
