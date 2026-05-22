const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    collegeId: { type: String, required: true, unique: true, trim: true },
    phone: { type: String, trim: true },
    department: { type: String, trim: true },
    year: { type: Number },
    role: { type: String, enum: ['student'], default: 'student' },
    isActive: { type: Boolean, default: true },
    expoPushToken: { type: String },
    otp: { type: String },
    otpExpiresAt: { type: Date },
    otpAttempts: { type: Number, default: 0 },
    lastOtpSentAt: { type: Date },
    refreshToken: { type: String },
  },
  { timestamps: true }
);

userSchema.index({ createdAt: -1 });

module.exports = mongoose.model('User', userSchema);
