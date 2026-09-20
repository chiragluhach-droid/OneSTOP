const express = require('express');
const router = express.Router();
const { protectAdmin } = require('../middleware/auth');
const adminStaffController = require('../controllers/adminStaffController');

router.use(protectAdmin);

router.get('/', adminStaffController.getAllStaff);
router.post('/', adminStaffController.createStaff);
router.delete('/:id', adminStaffController.deleteStaff);

module.exports = router;
