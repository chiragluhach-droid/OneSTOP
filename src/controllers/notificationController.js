const Notification = require('../models/Notification');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const getNotifications = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments({ user: req.user._id }),
      Notification.countDocuments({ user: req.user._id, isRead: false }),
    ]);

    return successResponse(res, {
      notifications,
      unreadCount,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return errorResponse(res, 'Failed to fetch notifications', 500);
  }
};

const markAsRead = async (req, res) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { isRead: true, readAt: new Date() }
    );
    return successResponse(res, {}, 'Marked as read');
  } catch (err) {
    return errorResponse(res, 'Failed to update notification', 500);
  }
};

const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );
    return successResponse(res, {}, 'All notifications marked as read');
  } catch (err) {
    return errorResponse(res, 'Failed to update notifications', 500);
  }
};

module.exports = { getNotifications, markAsRead, markAllAsRead };
