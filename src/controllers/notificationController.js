const Notification = require('../models/Notification');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { registerToken, unregisterToken } = require('../services/pushService');

// One set of handlers for both audiences. `protectAny` populates req.user for a
// student and req.staff for a staff member, and every query is scoped to
// whichever one is present — so there is no path by which one person's
// notifications can be read or cleared by another.
const scopeFor = (req) => {
  if (req.user) return { user: req.user._id };
  if (req.staff) return { staff: req.staff._id };
  return null;
};

const getNotifications = async (req, res) => {
  try {
    const scope = scopeFor(req);
    if (!scope) return errorResponse(res, 'Not authorised', 401);

    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(scope)
        .populate('request', 'ticketId subject status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(scope),
      Notification.countDocuments({ ...scope, isRead: false }),
    ]);

    return successResponse(res, {
      notifications,
      unreadCount,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('getNotifications error:', err);
    return errorResponse(res, 'Failed to fetch notifications', 500);
  }
};

/**
 * GET /api/notifications/unread-count
 * The app calls this on launch and on every return to the foreground to
 * reconcile its icon badge, so it is deliberately cheap — one indexed count.
 */
const getUnreadCount = async (req, res) => {
  try {
    const scope = scopeFor(req);
    if (!scope) return errorResponse(res, 'Not authorised', 401);

    const unreadCount = await Notification.countDocuments({ ...scope, isRead: false });
    return successResponse(res, { unreadCount });
  } catch (err) {
    return errorResponse(res, 'Failed to fetch unread count', 500);
  }
};

const markAsRead = async (req, res) => {
  try {
    const scope = scopeFor(req);
    if (!scope) return errorResponse(res, 'Not authorised', 401);

    const updated = await Notification.findOneAndUpdate(
      { _id: req.params.id, ...scope },
      { isRead: true, readAt: new Date() },
      { new: true }
    );
    if (!updated) return errorResponse(res, 'Notification not found', 404);

    // Returned so the app can set the icon badge without a second round trip.
    const unreadCount = await Notification.countDocuments({ ...scope, isRead: false });
    return successResponse(res, { unreadCount }, 'Marked as read');
  } catch (err) {
    return errorResponse(res, 'Failed to update notification', 500);
  }
};

const markAllAsRead = async (req, res) => {
  try {
    const scope = scopeFor(req);
    if (!scope) return errorResponse(res, 'Not authorised', 401);

    await Notification.updateMany({ ...scope, isRead: false }, { isRead: true, readAt: new Date() });
    return successResponse(res, { unreadCount: 0 }, 'All notifications marked as read');
  } catch (err) {
    return errorResponse(res, 'Failed to update notifications', 500);
  }
};

/**
 * POST /api/notifications/register-token
 * Called by the app once permission has been granted. Registering moves the
 * token off any other account that holds it — see pushService.registerToken.
 */
const registerPushToken = async (req, res) => {
  try {
    if (!req.user && !req.staff) return errorResponse(res, 'Not authorised', 401);

    const { token, platform, deviceId } = req.body;
    const saved = await registerToken({
      token,
      platform,
      deviceId,
      user: req.user || null,
      staff: req.user ? null : req.staff,
    });

    const scope = scopeFor(req);
    const unreadCount = await Notification.countDocuments({ ...scope, isRead: false });

    return successResponse(res, { registered: true, unreadCount }, 'Push token registered');
  } catch (err) {
    if (err.statusCode === 400) return errorResponse(res, err.message, 400);
    console.error('registerPushToken error:', err);
    return errorResponse(res, 'Failed to register push token', 500);
  }
};

/**
 * POST /api/notifications/unregister-token
 * Called on sign-out. Without this, the next person to sign in on a shared
 * device would keep receiving the previous account's updates.
 */
const unregisterPushToken = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return errorResponse(res, 'token is required', 400);
    await unregisterToken(token);
    return successResponse(res, { unregistered: true }, 'Push token removed');
  } catch (err) {
    console.error('unregisterPushToken error:', err);
    return errorResponse(res, 'Failed to remove push token', 500);
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  registerPushToken,
  unregisterPushToken,
};
