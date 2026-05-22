const Teacher = require('../models/Teacher');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const getTeachers = async (req, res) => {
  try {
    const filter = { isActive: true };
    if (req.query.school) filter.school = req.query.school;

    const teachers = await Teacher.find(filter).populate('school', 'name code').sort({ name: 1 });
    return successResponse(res, { teachers });
  } catch (err) {
    return errorResponse(res, 'Failed to fetch teachers', 500);
  }
};

const getTeachersBySchool = async (req, res) => {
  try {
    const teachers = await Teacher.find({ school: req.params.schoolId, isActive: true })
      .select('name email designation')
      .sort({ name: 1 });
    return successResponse(res, { teachers });
  } catch (err) {
    return errorResponse(res, 'Failed to fetch teachers', 500);
  }
};

const createTeacher = async (req, res) => {
  try {
    const { name, email, designation, school } = req.body;
    if (!name || !email || !designation || !school) {
      return errorResponse(res, 'Name, email, designation, and school are required', 400);
    }

    const teacher = await Teacher.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      designation: designation.trim(),
      school,
    });

    const populated = await Teacher.findById(teacher._id).populate('school', 'name code');
    return successResponse(res, { teacher: populated }, 'Teacher created', 201);
  } catch (err) {
    if (err.code === 11000) return errorResponse(res, 'Teacher with this email already exists', 409);
    return errorResponse(res, 'Failed to create teacher', 500);
  }
};

const updateTeacher = async (req, res) => {
  try {
    const teacher = await Teacher.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate('school', 'name code');
    if (!teacher) return errorResponse(res, 'Teacher not found', 404);
    return successResponse(res, { teacher }, 'Teacher updated');
  } catch (err) {
    return errorResponse(res, 'Failed to update teacher', 500);
  }
};

const deleteTeacher = async (req, res) => {
  try {
    const teacher = await Teacher.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!teacher) return errorResponse(res, 'Teacher not found', 404);
    return successResponse(res, {}, 'Teacher deactivated');
  } catch (err) {
    return errorResponse(res, 'Failed to delete teacher', 500);
  }
};

module.exports = { getTeachers, getTeachersBySchool, createTeacher, updateTeacher, deleteTeacher };
