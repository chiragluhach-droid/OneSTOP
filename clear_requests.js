require('dotenv').config();
const mongoose = require('mongoose');

const clearRequests = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Models that need to be cleared
    const Request = require('./src/models/Request');
    const WorkflowStage = require('./src/models/WorkflowStage');
    const ApprovalToken = require('./src/models/ApprovalToken');
    const Notification = require('./src/models/Notification');

    // Delete all documents in these collections
    const reqRes = await Request.deleteMany({});
    console.log(`Deleted ${reqRes.deletedCount} Requests`);

    const stageRes = await WorkflowStage.deleteMany({});
    console.log(`Deleted ${stageRes.deletedCount} WorkflowStages`);

    const tokenRes = await ApprovalToken.deleteMany({});
    console.log(`Deleted ${tokenRes.deletedCount} ApprovalTokens`);

    const notifRes = await Notification.deleteMany({});
    console.log(`Deleted ${notifRes.deletedCount} Notifications`);

    console.log('Successfully cleared all request-related data for a fresh start!');
  } catch (err) {
    console.error('Error clearing data:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

clearRequests();
