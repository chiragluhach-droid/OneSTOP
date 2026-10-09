const express = require('express');
const router = express.Router();
const { protectAdmin } = require('../middleware/auth');
const {
  previewBroadcast,
  sendBroadcast,
  listBroadcasts,
  getAudiences,
} = require('../controllers/broadcastController');

router.use(protectAdmin);

router.get('/', listBroadcasts);
router.get('/audiences', getAudiences);
router.post('/preview', previewBroadcast);
router.post('/', sendBroadcast);

module.exports = router;
