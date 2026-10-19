const mongoose = require('mongoose');
const Request = require('../models/Request');
const WorkflowStage = require('../models/WorkflowStage');
const User = require('../models/User');
const Staff = require('../models/Staff');
const School = require('../models/School');
const Category = require('../models/Category');
const Setting = require('../models/Setting');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { withLinks } = require('../utils/fileLinks');

/**
 * GET /api/admin/super-admin/metrics
 * Comprehensive executive observatory metrics & charts data
 */
const getSuperAdminMetrics = async (req, res) => {
  try {
    const [
      totalStudents,
      activeStudents,
      totalStaff,
      staffByRole,
      requestsByStatusAgg,
      turnaroundAgg,
      categoryAgg,
      schoolAgg,
      escalatedStagesCount,
      recentRequests,
      oldestPendingRequests,
      departmentsAgg,
      escalationSetting,
    ] = await Promise.all([
      // Total students
      User.countDocuments({ role: 'student' }),

      // Active students
      User.countDocuments({ role: 'student', isActive: true }),

      // Total staff
      Staff.countDocuments(),

      // Staff breakdown by role
      Staff.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      // Requests breakdown by status
      Request.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),

      // Average turnaround time (resolved tickets)
      Request.aggregate([
        {
          $match: {
            isDeleted: false,
            status: 'resolved',
            resolvedAt: { $exists: true, $ne: null },
          },
        },
        {
          $project: {
            diffHours: {
              $divide: [{ $subtract: ['$resolvedAt', '$createdAt'] }, 1000 * 60 * 60],
            },
          },
        },
        {
          $group: {
            _id: null,
            avgHours: { $avg: '$diffHours' },
            minHours: { $min: '$diffHours' },
            maxHours: { $max: '$diffHours' },
            resolvedCount: { $sum: 1 },
          },
        },
      ]),

      // Requests by Category
      Request.aggregate([
        { $match: { isDeleted: false } },
        {
          $group: {
            _id: '$category',
            total: { $sum: 1 },
            resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
            pending: {
              $sum: {
                $cond: [{ $in: ['$status', ['pending', 'in_review', 'in_progress']] }, 1, 0],
              },
            },
            rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
          },
        },
        {
          $lookup: {
            from: 'categories',
            localField: '_id',
            foreignField: '_id',
            as: 'cat',
          },
        },
        { $unwind: { path: '$cat', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            categoryId: '$_id',
            name: { $ifNull: ['$cat.name', 'Unassigned'] },
            code: { $ifNull: ['$cat.code', 'OTHER'] },
            icon: '$cat.icon',
            total: 1,
            resolved: 1,
            pending: 1,
            rejected: 1,
          },
        },
        { $sort: { total: -1 } },
      ]),

      // Requests by School
      Request.aggregate([
        { $match: { isDeleted: false } },
        {
          $group: {
            _id: '$school',
            total: { $sum: 1 },
            resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
            pending: {
              $sum: {
                $cond: [{ $in: ['$status', ['pending', 'in_review', 'in_progress']] }, 1, 0],
              },
            },
          },
        },
        {
          $lookup: {
            from: 'schools',
            localField: '_id',
            foreignField: '_id',
            as: 'schoolDoc',
          },
        },
        { $unwind: { path: '$schoolDoc', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            schoolId: '$_id',
            name: { $ifNull: ['$schoolDoc.name', 'Unassigned'] },
            code: { $ifNull: ['$schoolDoc.code', 'OTHER'] },
            deanEmail: '$schoolDoc.deanEmail',
            total: 1,
            resolved: 1,
            pending: 1,
          },
        },
        { $sort: { total: -1 } },
      ]),

      // Escalated stages count
      WorkflowStage.countDocuments({ escalatedAt: { $ne: null } }),

      // Recent 8 requests
      Request.find({ isDeleted: false })
        .populate('student', 'name email rollNumber department')
        .populate('category', 'name code')
        .populate('school', 'name code')
        .sort({ createdAt: -1 })
        .limit(8),

      // Oldest open/pending requests (bottlenecks: pending/in_review/in_progress)
      Request.find({
        isDeleted: false,
        status: { $in: ['pending', 'in_review', 'in_progress'] },
      })
        .populate('student', 'name email rollNumber department')
        .populate('category', 'name code')
        .populate('school', 'name code')
        .sort({ createdAt: 1 })
        .limit(8),

      // Top student departments
      User.aggregate([
        { $match: { role: 'student', department: { $exists: true, $ne: '' } } },
        {
          $group: {
            _id: '$department',
            count: { $sum: 1 },
            schoolId: { $first: '$school' },
          },
        },
        {
          $lookup: {
            from: 'schools',
            localField: 'schoolId',
            foreignField: '_id',
            as: 'schoolDoc',
          },
        },
        { $unwind: { path: '$schoolDoc', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            department: '$_id',
            schoolCode: '$schoolDoc.code',
            schoolName: '$schoolDoc.name',
            count: 1,
          },
        },
        { $sort: { count: -1 } },
        { $limit: 12 },
      ]),

      // Global Escalation configuration
      Setting.findOne({ key: 'escalation' }).lean(),
    ]);

    // Format status counts
    const statusMap = {
      pending: 0,
      in_review: 0,
      in_progress: 0,
      resolved: 0,
      rejected: 0,
      escalated: 0,
    };
    let totalRequests = 0;
    requestsByStatusAgg.forEach((item) => {
      statusMap[item._id] = item.count;
      totalRequests += item.count;
    });

    const activeRequests = (statusMap.pending || 0) + (statusMap.in_review || 0) + (statusMap.in_progress || 0);
    const resolvedRequests = statusMap.resolved || 0;
    const resolutionRate = totalRequests > 0 ? Math.round((resolvedRequests / totalRequests) * 100) : 0;

    const avgResolutionTime = turnaroundAgg.length > 0 && turnaroundAgg[0].avgHours != null
      ? Number(turnaroundAgg[0].avgHours.toFixed(1))
      : 0;

    return successResponse(res, {
      summary: {
        totalStudents,
        activeStudents,
        totalStaff,
        totalRequests,
        activeRequests,
        resolvedRequests,
        rejectedRequests: statusMap.rejected || 0,
        escalatedStagesCount,
        resolutionRate,
        avgResolutionTimeHours: avgResolutionTime,
      },
      statusDistribution: statusMap,
      staffByRole,
      byCategory: categoryAgg,
      bySchool: schoolAgg,
      topDepartments: departmentsAgg,
      recentRequests,
      bottlenecks: oldestPendingRequests,
      escalationConfig: escalationSetting?.value || null,
    });
  } catch (err) {
    console.error('getSuperAdminMetrics error:', err);
    return errorResponse(res, 'Failed to fetch super-admin metrics', 500);
  }
};

/**
 * GET /api/admin/super-admin/students
 * Paginated student directory with department/school breakdown and request counts
 */
const getSuperAdminStudents = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 25, 100);
    const skip = (page - 1) * limit;

    const matchFilter = { role: 'student' };
    if (req.query.school && mongoose.Types.ObjectId.isValid(req.query.school)) {
      matchFilter.school = new mongoose.Types.ObjectId(req.query.school);
    }
    if (req.query.department) {
      matchFilter.department = req.query.department;
    }
    if (req.query.search) {
      const re = new RegExp(req.query.search, 'i');
      matchFilter.$or = [{ name: re }, { email: re }, { rollNumber: re }, { department: re }];
    }

    const [studentsAgg, total] = await Promise.all([
      User.aggregate([
        { $match: matchFilter },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: 'schools',
            localField: 'school',
            foreignField: '_id',
            as: 'schoolDoc',
          },
        },
        { $unwind: { path: '$schoolDoc', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'requests',
            let: { studentId: '$_id' },
            pipeline: [
              { $match: { $expr: { $eq: ['$student', '$$studentId'] }, isDeleted: false } },
              { $project: { _id: 1, status: 1 } },
            ],
            as: 'reqs',
          },
        },
        {
          $project: {
            name: 1,
            email: 1,
            rollNumber: 1,
            department: 1,
            isActive: 1,
            createdAt: 1,
            school: {
              _id: '$schoolDoc._id',
              name: '$schoolDoc.name',
              code: '$schoolDoc.code',
            },
            requestsTotal: { $size: '$reqs' },
            requestsResolved: {
              $size: {
                $filter: {
                  input: '$reqs',
                  as: 'r',
                  cond: { $eq: ['$$r.status', 'resolved'] },
                },
              },
            },
          },
        },
      ]),
      User.countDocuments(matchFilter),
    ]);

    return successResponse(res, {
      students: studentsAgg,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('getSuperAdminStudents error:', err);
    return errorResponse(res, 'Failed to fetch student directory', 500);
  }
};

/**
 * GET /api/admin/super-admin/students/:id
 * Detailed student profile + all requests raised by student
 */
const getSuperAdminStudentDetail = async (req, res) => {
  try {
    const { id } = req.params;
    let query = { role: 'student' };
    if (mongoose.Types.ObjectId.isValid(id)) {
      query._id = id;
    } else {
      query.$or = [{ rollNumber: id }, { email: id.toLowerCase().trim() }];
    }

    const student = await User.findOne(query)
      .populate('school', 'name code hodEmail deanEmail')
      .select('-otp -otpExpiresAt -refreshToken');

    if (!student) return errorResponse(res, 'Student not found', 404);

    const requests = await Request.find({ student: student._id, isDeleted: false })
      .populate('category', 'name code icon')
      .populate('school', 'name code')
      .sort({ createdAt: -1 });

    return successResponse(res, {
      student,
      requests,
      totalRequests: requests.length,
      resolvedRequests: requests.filter((r) => r.status === 'resolved').length,
    });
  } catch (err) {
    console.error('getSuperAdminStudentDetail error:', err);
    return errorResponse(res, 'Failed to fetch student detail', 500);
  }
};

/**
 * GET /api/admin/super-admin/staff
 * Staff directory with role counts and pending workflow stages assigned
 */
const getSuperAdminStaff = async (req, res) => {
  try {
    const staffList = await Staff.find().sort({ role: 1, name: 1 });

    // Aggregate pending stages count for each staff email
    const emails = staffList.map((s) => s.email.toLowerCase().trim());
    const stagesAgg = await WorkflowStage.aggregate([
      { $match: { recipientEmails: { $in: emails }, status: 'pending' } },
      { $unwind: '$recipientEmails' },
      { $match: { recipientEmails: { $in: emails } } },
      { $group: { _id: '$recipientEmails', pendingCount: { $sum: 1 } } },
    ]);

    const pendingMap = {};
    stagesAgg.forEach((item) => {
      pendingMap[item._id.toLowerCase()] = item.pendingCount;
    });

    const enrichedStaff = staffList.map((s) => {
      const obj = s.toObject();
      obj.pendingStagesCount = pendingMap[s.email.toLowerCase()] || 0;
      return obj;
    });

    return successResponse(res, { staff: enrichedStaff });
  } catch (err) {
    console.error('getSuperAdminStaff error:', err);
    return errorResponse(res, 'Failed to fetch staff directory', 500);
  }
};

/**
 * GET /api/admin/super-admin/requests
 * Live request ledger with search, filters, current stage, and escalation indicators
 */
const getSuperAdminRequests = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 25, 100);
    const skip = (page - 1) * limit;

    const filter = { isDeleted: false };
    if (req.query.status && req.query.status !== 'all') {
      filter.status = req.query.status;
    }
    if (req.query.school && mongoose.Types.ObjectId.isValid(req.query.school)) {
      filter.school = req.query.school;
    }
    if (req.query.category && mongoose.Types.ObjectId.isValid(req.query.category)) {
      filter.category = req.query.category;
    }

    if (req.query.search) {
      const q = req.query.search.trim();
      const re = new RegExp(q, 'i');

      // Check if query matches a student first
      const matchedStudents = await User.find({
        $or: [{ name: re }, { rollNumber: re }, { email: re }],
      }).select('_id');

      const studentIds = matchedStudents.map((s) => s._id);

      filter.$or = [
        { ticketId: re },
        { subject: re },
        { description: re },
        { student: { $in: studentIds } },
      ];
    }

    // Escalated filter
    if (req.query.escalatedOnly === 'true') {
      const escalatedStages = await WorkflowStage.find({ escalatedAt: { $ne: null } }).distinct('request');
      filter._id = { $in: escalatedStages };
    }

    const [requests, total] = await Promise.all([
      Request.find(filter)
        .populate('student', 'name email rollNumber department')
        .populate('category', 'name code icon')
        .populate('school', 'name code')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Request.countDocuments(filter),
    ]);

    // Attach active/current workflow stage for each request
    const requestIds = requests.map((r) => r._id);
    const allStages = await WorkflowStage.find({ request: { $in: requestIds } })
      .select('request stageIndex stageName ownerLabel status escalatedAt recipientEmails actionTakenAt')
      .sort({ stageIndex: 1 });

    const stagesByReq = {};
    allStages.forEach((st) => {
      const rId = st.request.toString();
      if (!stagesByReq[rId]) stagesByReq[rId] = [];
      stagesByReq[rId].push(st);
    });

    const enriched = requests.map((r) => {
      const obj = r.toObject();
      const stages = stagesByReq[r._id.toString()] || [];
      const currentStage = stages.find((s) => s.stageIndex === r.currentStageIndex) || stages[stages.length - 1] || null;
      obj.stagesCount = stages.length;
      obj.currentStage = currentStage;
      obj.isEscalated = stages.some((s) => s.escalatedAt != null) || r.status === 'escalated';
      return obj;
    });

    return successResponse(res, {
      requests: enriched,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('getSuperAdminRequests error:', err);
    return errorResponse(res, 'Failed to fetch requests ledger', 500);
  }
};

/**
 * GET /api/admin/super-admin/requests/:id
 * Full single request observatory view with all stages and handover logs
 */
const getSuperAdminRequestDetail = async (req, res) => {
  try {
    const { id } = req.params;
    let query = { isDeleted: false };
    if (mongoose.Types.ObjectId.isValid(id)) {
      query._id = id;
    } else {
      query.ticketId = id;
    }

    const request = await Request.findOne(query)
      .populate('student', 'name email rollNumber department school')
      .populate('category', 'name code icon description processOwners')
      .populate('school', 'name code hodEmail deanEmail');

    if (!request) return errorResponse(res, 'Request not found', 404);

    const stages = await WorkflowStage.find({ request: request._id }).sort({ stageIndex: 1 });

    const reqObj = request.toObject();
    reqObj.attachments = withLinks(reqObj.attachments);

    const stagesObj = stages.map((s) => {
      const obj = s.toObject();
      obj.attachments = withLinks(obj.attachments);
      return obj;
    });

    return successResponse(res, {
      request: reqObj,
      stages: stagesObj,
    });
  } catch (err) {
    console.error('getSuperAdminRequestDetail error:', err);
    return errorResponse(res, 'Failed to fetch request detail', 500);
  }
};

module.exports = {
  getSuperAdminMetrics,
  getSuperAdminStudents,
  getSuperAdminStudentDetail,
  getSuperAdminStaff,
  getSuperAdminRequests,
  getSuperAdminRequestDetail,
};
