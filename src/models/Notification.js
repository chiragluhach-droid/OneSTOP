const mongoose = require('mongoose');

// One row per thing a person should know about. Students and staff both get
// them, so the recipient is stored as exactly one of two fields rather than a
// polymorphic pair: every query in the app filters on `user` or on `staff`, and
// keeping them as distinct indexed refs means no query has to know about the
// other kind.
const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    staff: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },

    title: { type: String, required: true },
    body: { type: String, required: true },
    type: {
      type: String,
      enum: [
        'request_submitted',
        'request_received',
        'stage_approved',
        'request_in_progress',
        'request_in_review',
        'request_rejected',
        'request_resolved',
        'request_reopened',
        'request_escalated',
        'request_assigned',
        'escalation_message',
        'broadcast',
        'general',
      ],
      default: 'general',
    },
    request: { type: mongoose.Schema.Types.ObjectId, ref: 'Request' },

    // Carried through to the push payload so tapping the notification can open
    // the right screen.
    data: { type: mongoose.Schema.Types.Mixed, default: {} },

    isRead: { type: Boolean, default: false },
    readAt: { type: Date },

    // Delivery bookkeeping. A notification is still a valid in-app row when the
    // push fails (no device registered, token expired), so failure is recorded
    // rather than thrown.
    pushSentAt: { type: Date },
    pushError: { type: String },
  },
  { timestamps: true }
);

// Exactly one recipient. Guards against a row that would be invisible to
// everyone, or one that double-counts in two people's unread badges.
notificationSchema.pre('validate', function requireOneRecipient(next) {
  if (!this.user && !this.staff) return next(new Error('Notification needs a user or a staff recipient'));
  if (this.user && this.staff) return next(new Error('Notification cannot target both a user and a staff member'));
  return next();
});

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ staff: 1, createdAt: -1 });
// Backs the unread-count query that drives the app icon badge.
notificationSchema.index({ user: 1, isRead: 1 });
notificationSchema.index({ staff: 1, isRead: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
