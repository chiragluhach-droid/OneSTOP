const express = require('express');
const router = express.Router();
const { protectAny, protectAdmin } = require('../middleware/auth');
const {
  getTeachers, getTeachersBySchool, createTeacher, updateTeacher, deleteTeacher,
} = require('../controllers/teacherController');

router.get('/', protectAny, getTeachers);
router.get('/by-school/:schoolId', protectAny, getTeachersBySchool);
router.post('/', protectAdmin, createTeacher);
router.patch('/:id', protectAdmin, updateTeacher);
router.delete('/:id', protectAdmin, deleteTeacher);

module.exports = router;
