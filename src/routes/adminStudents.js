const express = require('express');
const { protectAdmin } = require('../middleware/auth');
const { getStudents, getStudentStats } = require('../controllers/adminStudentController');

const router = express.Router();

router.get('/stats', protectAdmin, getStudentStats);
router.get('/',      protectAdmin, getStudents);

module.exports = router;
