const School = require('../models/School');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const getSchools = async (req, res) => {
  try {
    const schools = await School.find({ isActive: true }).sort({ name: 1 });
    return successResponse(res, { schools });
  } catch (err) {
    return errorResponse(res, 'Failed to fetch schools', 500);
  }
};

const createSchool = async (req, res) => {
  try {
    const { name, code, description, hodEmail, deanEmail } = req.body;
    if (!name || !code) return errorResponse(res, 'Name and code required', 400);

    const school = await School.create({
      name: name.trim(),
      code: code.toUpperCase().trim(),
      description,
      hodEmail: hodEmail?.trim(),
      deanEmail: deanEmail?.trim(),
    });
    return successResponse(res, { school }, 'School created', 201);
  } catch (err) {
    if (err.code === 11000) return errorResponse(res, 'School already exists', 409);
    return errorResponse(res, 'Failed to create school', 500);
  }
};

const updateSchool = async (req, res) => {
  try {
    const school = await School.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!school) return errorResponse(res, 'School not found', 404);
    return successResponse(res, { school }, 'School updated');
  } catch (err) {
    return errorResponse(res, 'Failed to update school', 500);
  }
};

const deleteSchool = async (req, res) => {
  try {
    const school = await School.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!school) return errorResponse(res, 'School not found', 404);
    return successResponse(res, {}, 'School deactivated');
  } catch (err) {
    return errorResponse(res, 'Failed to delete school', 500);
  }
};

module.exports = { getSchools, createSchool, updateSchool, deleteSchool };
