const mongoose = require('mongoose');

// One row per device a person has signed in on. An array rather than a single
// field because a student may well have a phone and a tablet, and silently
// overwriting the first with the second means they stop getting notifications
// on it with no way to tell.
//
// Shared by User and Staff so there is one shape to reason about.
const pushTokenSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, trim: true },
    platform: { type: String, enum: ['ios', 'android', 'web', 'unknown'], default: 'unknown' },
    // Lets a reinstall replace its own row instead of adding a second one.
    deviceId: { type: String, trim: true },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

module.exports = pushTokenSchema;
