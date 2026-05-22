const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    type: {
      type: String,
      enum: ['request_submitted', 'stage_approved', 'request_rejected', 'request_resolved', 'general'],
      default: 'general',
    },
    request: { type: mongoose.Schema.Types.ObjectId, ref: 'Request' },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ isRead: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
