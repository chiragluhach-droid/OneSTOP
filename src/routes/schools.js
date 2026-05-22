const express = require('express');
const router = express.Router();
const { protectAny, protectAdmin } = require('../middleware/auth');
const { getSchools, createSchool, updateSchool, deleteSchool } = require('../controllers/schoolController');

router.get('/', protectAny, getSchools);
router.post('/', protectAdmin, createSchool);
router.patch('/:id', protectAdmin, updateSchool);
router.delete('/:id', protectAdmin, deleteSchool);

module.exports = router;
