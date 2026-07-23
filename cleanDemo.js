require('dotenv').config();
const mongoose = require('mongoose');

const DEMO_EMAIL = 'demo@onestop.mru.edu.in';
const MONGO_URI = process.env.MONGO_URI;

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const User        = require('./src/models/User');
  const Request     = require('./src/models/Request');
  const WorkflowStage   = require('./src/models/WorkflowStage');
  const ApprovalToken   = require('./src/models/ApprovalToken');
  const Notification    = require('./src/models/Notification');
  const AuditLog        = require('./src/models/AuditLog');

  const demo = await User.findOne({ email: DEMO_EMAIL });
  if (!demo) { console.log('Demo user not found'); process.exit(1); }
  console.log('Demo user:', demo.name, demo._id.toString());

  // Find all requests by demo user
  const requests = await Request.find({ student: demo._id });
  const requestIds = requests.map(r => r._id);
  console.log(`Found ${requests.map(r => r.ticketId).join(', ') || 'none'}`);

  if (requestIds.length > 0) {
    const [stages, tokens, notifs, logs] = await Promise.all([
      WorkflowStage.deleteMany({ request: { $in: requestIds } }),
      ApprovalToken.deleteMany({ request: { $in: requestIds } }),
      Notification.deleteMany({ request: { $in: requestIds } }),
      AuditLog.deleteMany({ request: { $in: requestIds } }),
    ]);
    await Request.deleteMany({ student: demo._id });

    console.log(`Deleted: ${requestIds.length} requests, ${stages.deletedCount} stages, ${tokens.deletedCount} tokens, ${notifs.deletedCount} notifications, ${logs.deletedCount} audit logs`);
  }

  // Reset demo user — clear OTP, tokens so it's clean
  await User.updateOne({ _id: demo._id }, {
    $unset: { otp: 1, otpExpiresAt: 1, otpAttempts: 1, lastOtpSentAt: 1, refreshToken: 1 }
  });
  console.log('Demo user reset to clean state');

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch(err => { console.error(err); process.exit(1); });
