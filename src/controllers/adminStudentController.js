const User = require('../models/User');
const School = require('../models/School');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const getStudents = async (req, res) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip  = (page - 1) * limit;

    const filter = { role: 'student' };
    if (req.query.school)     filter.school     = req.query.school;
    if (req.query.department) filter.department = req.query.department;
    if (req.query.search) {
      const re = new RegExp(req.query.search, 'i');
      filter.$or = [{ name: re }, { email: re }, { rollNumber: re }];
    }

    const [students, total] = await Promise.all([
      User.find(filter)
        .populate('school', 'name code')
        .select('name email rollNumber department school isActive')
        .sort({ school: 1, department: 1, name: 1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    return successResponse(res, {
      students,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('getStudents error:', err);
    return errorResponse(res, 'Failed to fetch students', 500);
  }
};

const getStudentStats = async (req, res) => {
  try {
    const total = await User.countDocuments({ role: 'student' });

    const pipeline = [
      { $match: { role: 'student' } },
      {
        $group: {
          _id: { school: '$school', department: '$department' },
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'schools',
          localField: '_id.school',
          foreignField: '_id',
          as: 'schoolDoc',
        },
      },
      { $unwind: { path: '$schoolDoc', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$_id.school',
          schoolName: { $first: '$schoolDoc.name' },
          schoolCode: { $first: '$schoolDoc.code' },
          totalCount: { $sum: '$count' },
          departments: {
            $push: { department: '$_id.department', count: '$count' },
          },
        },
      },
      { $sort: { totalCount: -1 } },
    ];

    const bySchool = await User.aggregate(pipeline);

    return successResponse(res, { total, bySchool });
  } catch (err) {
    console.error('getStudentStats error:', err);
    return errorResponse(res, 'Failed to fetch student stats', 500);
  }
};

module.exports = { getStudents, getStudentStats };
