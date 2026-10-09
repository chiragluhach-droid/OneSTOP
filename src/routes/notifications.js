const express = require('express');
const router = express.Router();
const { protectAny } = require('../middleware/auth');
const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  registerPushToken,
  unregisterPushToken,
} = require('../controllers/notificationController');

// protectAny rather than protect: staff read their own notifications through
// the same endpoints, and each handler scopes its query to whichever of
// req.user / req.staff the token resolved to.
router.use(protectAny);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);

router.post('/register-token', registerPushToken);
router.post('/unregister-token', unregisterPushToken);

// Declared before '/:id/read' so "read-all" is never read as an id.
router.patch('/read-all', markAllAsRead);
router.patch('/:id/read', markAsRead);

module.exports = router;
