const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name:          { type: String, required: true, trim: true },
    email:         { type: String, required: true, unique: true, lowercase: true, trim: true },
    rollNumber:    { type: String, required: true, unique: true, trim: true },
    school:        { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
    department:    { type: String, trim: true },
    role:          { type: String, enum: ['student'], default: 'student' },
    isActive:      { type: Boolean, default: true },
    expoPushToken: { type: String },
    otp:           { type: String },
    otpExpiresAt:  { type: Date },
    otpAttempts:   { type: Number, default: 0 },
    lastOtpSentAt: { type: Date },
    refreshToken:  { type: String },
  },
  { timestamps: true }
);

userSchema.index({ createdAt: -1 });
userSchema.index({ school: 1, department: 1 });

module.exports = mongoose.model('User', userSchema);
