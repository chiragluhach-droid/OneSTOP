const Staff = require('../models/Staff');
const { successResponse, errorResponse } = require('../utils/response');

const getAllStaff = async (req, res) => {
  try {
    const staff = await Staff.find().sort({ createdAt: -1 });
    return successResponse(res, { staff });
  } catch (err) {
    return errorResponse(res, 'Failed to fetch staff members', 500);
  }
};

const createStaff = async (req, res) => {
  try {
    const { name, email, designation, role } = req.body;
    if (!name || !email) {
      return errorResponse(res, 'Name and email are required', 400);
    }
    const normalizedEmail = email.toLowerCase().trim();

    const existingStaff = await Staff.findOne({ email: normalizedEmail });
    if (existingStaff) {
      return errorResponse(res, 'Staff with this email already exists', 400);
    }

    const staff = await Staff.create({
      name,
      email: normalizedEmail,
      designation,
      role: role || 'staff',
    });

    return successResponse(res, { staff }, 'Staff created successfully', 201);
  } catch (err) {
    return errorResponse(res, 'Failed to create staff member', 500);
  }
};

const deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;
    await Staff.findByIdAndDelete(id);
    return successResponse(res, null, 'Staff removed successfully');
  } catch (err) {
    return errorResponse(res, 'Failed to delete staff member', 500);
  }
};

module.exports = {
  getAllStaff,
  createStaff,
  deleteStaff,
};
