const User = require('../models/User');
const Staff = require('../models/Staff');
const School = require('../models/School');
const Broadcast = require('../models/Broadcast');
const { notifyMany } = require('../services/notifyService');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const auditLog = require('../utils/auditLogger');

const MAX_TITLE = 100;
const MAX_BODY = 500;
const STAFF_ROLES = ['dsw', 'dean', 'hod', 'staff'];

const asArray = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);
const cleanEmails = (v) =>
  [...new Set(asArray(v).map((e) => String(e || '').trim().toLowerCase()).filter(Boolean))];
const cleanStrings = (v) =>
  [...new Set(asArray(v).map((s) => String(s || '').trim()).filter(Boolean))];

/**
 * Turn a request body into the two recipient queries.
 *
 * Narrowing is additive within an audience: picking two schools means students
 * in either. An explicit email list overrides the filters for that audience —
 * if someone has named individuals, they mean those individuals.
 */
const buildFilters = (body) => {
  const audience = body.audience;
  const schoolIds = cleanStrings(body.schoolIds);
  const departments = cleanStrings(body.departments);
  const staffRoles = cleanStrings(body.staffRoles).filter((r) => STAFF_ROLES.includes(r));
  const studentEmails = cleanEmails(body.studentEmails);
  const staffEmails = cleanEmails(body.staffEmails);

  const wantsStudents = audience === 'students' || audience === 'both';
  const wantsStaff = audience === 'staff' || audience === 'both';

  let studentQuery = null;
  if (wantsStudents) {
    if (studentEmails.length) {
      studentQuery = { email: { $in: studentEmails }, isActive: true };
    } else {
      studentQuery = { isActive: true };
      const or = [];
      if (schoolIds.length) or.push({ school: { $in: schoolIds } });
      if (departments.length) or.push({ department: { $in: departments } });
      if (or.length) studentQuery.$or = or;
    }
  }

  let staffQuery = null;
  if (wantsStaff) {
    if (staffEmails.length) {
      staffQuery = { email: { $in: staffEmails }, isActive: true };
    } else {
      staffQuery = { isActive: true };
      if (staffRoles.length) staffQuery.role = { $in: staffRoles };
    }
  }

  return {
    studentQuery,
    staffQuery,
    filters: { schoolIds, departments, staffRoles, studentEmails, staffEmails },
  };
};

const validate = (body) => {
  const title = String(body.title || '').trim();
  const text = String(body.body || '').trim();

  if (!['students', 'staff', 'both'].includes(body.audience)) {
    return { error: 'audience must be students, staff or both' };
  }
  if (title.length < 3) return { error: 'Give the announcement a title of at least 3 characters' };
  if (title.length > MAX_TITLE) return { error: `Keep the title under ${MAX_TITLE} characters` };
  if (text.length < 3) return { error: 'Write a message of at least 3 characters' };
  if (text.length > MAX_BODY) return { error: `Keep the message under ${MAX_BODY} characters` };

  return { title, text };
};

/**
 * POST /api/admin/broadcasts/preview
 *
 * How many people the current selection would reach, without sending anything.
 * A broadcast can't be recalled, so the admin screen requires this before the
 * send button does anything.
 */
const previewBroadcast = async (req, res) => {
  try {
    const { studentQuery, staffQuery } = buildFilters(req.body);

    const [students, staff] = await Promise.all([
      studentQuery ? User.countDocuments(studentQuery) : 0,
      staffQuery ? Staff.countDocuments(staffQuery) : 0,
    ]);

    // Devices, not people: plenty of accounts have never opened the app or have
    // declined notifications, and an admin should know that before sending.
    const [studentDevices, staffDevices] = await Promise.all([
      studentQuery
        ? User.countDocuments({ ...studentQuery, $and: [{ $or: [{ 'pushTokens.0': { $exists: true } }, { expoPushToken: { $exists: true, $ne: null } }] }] })
        : 0,
      staffQuery
        ? Staff.countDocuments({ ...staffQuery, $and: [{ $or: [{ 'pushTokens.0': { $exists: true } }, { expoPushToken: { $exists: true, $ne: null } }] }] })
        : 0,
    ]);

    return successResponse(res, {
      students,
      staff,
      total: students + staff,
      withDevices: studentDevices + staffDevices,
    });
  } catch (err) {
    console.error('previewBroadcast error:', err);
    return errorResponse(res, 'Failed to preview broadcast', 500);
  }
};

/** POST /api/admin/broadcasts — send it. */
const sendBroadcast = async (req, res) => {
  try {
    const { error, title, text } = validate(req.body);
    if (error) return errorResponse(res, error, 400);

    const { studentQuery, staffQuery, filters } = buildFilters(req.body);

    const [users, staff] = await Promise.all([
      studentQuery ? User.find(studentQuery).select('_id').lean() : [],
      staffQuery ? Staff.find(staffQuery).select('_id').lean() : [],
    ]);

    if (!users.length && !staff.length) {
      return errorResponse(res, 'That selection matches nobody. Widen it and try again.', 400);
    }

    const result = await notifyMany({
      users,
      staff,
      title,
      body: text,
      type: 'broadcast',
      data: { broadcast: true },
    });

    const status = result.recorded === 0 ? 'failed' : result.recorded < result.recipients ? 'partial' : 'sent';

    const record = await Broadcast.create({
      title,
      body: text,
      audience: req.body.audience,
      filters,
      sentBy: req.admin._id,
      sentByEmail: req.admin.email,
      recipients: result.recipients,
      recorded: result.recorded,
      devices: result.devices,
      pushed: result.pushed,
      failed: result.failed,
      status,
    });

    await auditLog({
      event: 'BROADCAST_SENT',
      actor: req.admin._id.toString(),
      actorModel: 'Admin',
      metadata: {
        broadcastId: record._id.toString(),
        audience: req.body.audience,
        recipients: result.recipients,
        pushed: result.pushed,
      },
      ipAddress: req.ip,
    });

    return successResponse(
      res,
      { broadcast: record },
      `Sent to ${result.recipients} ${result.recipients === 1 ? 'person' : 'people'} · ${result.pushed} device${result.pushed === 1 ? '' : 's'} notified`,
      201
    );
  } catch (err) {
    console.error('sendBroadcast error:', err);
    return errorResponse(res, 'Failed to send broadcast', 500);
  }
};

/** GET /api/admin/broadcasts — history, newest first. */
const listBroadcasts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    const [broadcasts, total] = await Promise.all([
      Broadcast.find({})
        .populate('filters.schoolIds', 'name code')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Broadcast.countDocuments({}),
    ]);

    return successResponse(res, {
      broadcasts,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return errorResponse(res, 'Failed to fetch broadcasts', 500);
  }
};

/**
 * GET /api/admin/broadcasts/audiences
 * The options the compose screen offers: schools, departments and staff roles
 * that actually exist, with live counts.
 */
const getAudiences = async (req, res) => {
  try {
    const [schools, departments, roleCounts, totals] = await Promise.all([
      School.find({ isActive: true }).select('name code').sort({ name: 1 }).lean(),
      User.distinct('department', { isActive: true, department: { $ne: null } }),
      Staff.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$role', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Promise.all([
        User.countDocuments({ isActive: true }),
        Staff.countDocuments({ isActive: true }),
      ]),
    ]);

    const schoolCounts = await User.aggregate([
      { $match: { isActive: true, school: { $ne: null } } },
      { $group: { _id: '$school', count: { $sum: 1 } } },
    ]);
    const bySchool = new Map(schoolCounts.map((r) => [String(r._id), r.count]));

    return successResponse(res, {
      schools: schools.map((s) => ({ ...s, studentCount: bySchool.get(String(s._id)) || 0 })),
      departments: departments.filter(Boolean).sort(),
      staffRoles: roleCounts.map((r) => ({ role: r._id, count: r.count })),
      totals: { students: totals[0], staff: totals[1] },
    });
  } catch (err) {
    console.error('getAudiences error:', err);
    return errorResponse(res, 'Failed to fetch audiences', 500);
  }
};

module.exports = { previewBroadcast, sendBroadcast, listBroadcasts, getAudiences };
