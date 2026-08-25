const Request = require('../models/Request');
const WorkflowStage = require('../models/WorkflowStage');
const Category = require('../models/Category');
const School = require('../models/School');
const Notification = require('../models/Notification');
const generateTicketId = require('../utils/generateTicketId');
const { sendApprovalEmail, sendCcFyiEmail } = require('../services/workflowService');
const { resolveRecipients } = require('../utils/recipients');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const auditLog = require('../utils/auditLogger');

const createRequest = async (req, res) => {
  try {
    const { categoryId, subject, description } = req.body;
    if (!categoryId || !subject || !description) {
      return errorResponse(res, 'All fields are required', 400);
    }

    if (!req.user.school) {
      return errorResponse(res, 'Your account has no school assigned. Please contact admin.', 400);
    }

    const [category, school] = await Promise.all([
      Category.findById(categoryId),
      School.findById(req.user.school._id || req.user.school),
    ]);

    if (!category) return errorResponse(res, 'Category not found', 404);
    if (!school) return errorResponse(res, 'School not found', 404);

    // @dean / @hod resolve against this student's school, so one category can
    // route to whichever dean actually owns them.
    const processOwners = resolveRecipients(category.processOwners, school);
    if (processOwners.length === 0) {
      const usesDynamic = (category.processOwners || []).some((o) => String(o).startsWith('@'));
      return errorResponse(
        res,
        usesDynamic
          ? `This category routes to your school's dean/HOD, but ${school.name} has no such contact on record. Please contact admin.`
          : 'This category has no process owners configured. Please contact admin.',
        400
      );
    }

    const attachments = (req.files || []).map((f) => ({
      url: f.location,
      publicId: f.key,
      originalName: f.originalname,
      mimeType: f.mimetype,
    }));

    let ticketId = generateTicketId();
    let exists = await Request.findOne({ ticketId });
    while (exists) {
      ticketId = generateTicketId();
      exists = await Request.findOne({ ticketId });
    }

    const totalStages = processOwners.length;

    // FYI copies go only to the category's explicit CC list. Nobody is added
    // implicitly — a dean or HOD is copied only if their address was put there.
    const ccEmails = resolveRecipients(category.ccEmails, school);

    const escalation = category.escalation || {};
    const escalationRecipients = escalation.enabled
      ? resolveRecipients(escalation.recipients, school)
      : [];

    const request = await Request.create({
      ticketId,
      student: req.user._id,
      category: category._id,
      school: school._id,
      subject: subject.trim(),
      description: description.trim(),
      attachments,
      status: 'pending',
      currentStageIndex: 0,
      totalStages,
    });

    // One stage per process owner — routing purely from category data
    const stageDefinitions = processOwners.map((ownerEmail, idx) => ({
      stageIndex: idx,
      stageName: `Stage ${idx + 1} — ${category.name}`,
      recipientEmails: [ownerEmail],
      ccEmails,
      escalationRecipients,
      escalateAfterHours: escalation.enabled ? escalation.afterHours || 48 : undefined,
    }));

    const stages = await WorkflowStage.insertMany(
      stageDefinitions.map((s) => ({ ...s, request: request._id, status: 'pending' }))
    );

    const canForward = totalStages > 1; // stage 0 can forward to stage 1 if multiple owners

    const isDemo = req.user.email === 'demo@onestop.mru.edu.in';
    if (!isDemo) {
      await sendApprovalEmail({
        request,
        workflowStage: stages[0],
        stageIndex: 0,
        canForward,
        student: req.user,
        category,
        school,
      });

      await sendCcFyiEmail({
        request,
        workflowStage: stages[0],
        student: req.user,
        category,
        school,
      });
    }

    await Request.findByIdAndUpdate(request._id, { status: 'in_review' });

    await Notification.create({
      user: req.user._id,
      title: 'Request Submitted',
      body: `Your request #${ticketId} has been submitted and is under initial review.`,
      type: 'request_submitted',
      request: request._id,
    });

    await auditLog({
      event: 'REQUEST_CREATED',
      actor: req.user._id.toString(),
      actorModel: 'User',
      request: request._id,
      metadata: { ticketId, category: category.name, school: school.name },
      ipAddress: req.ip,
    });

    return successResponse(
      res,
      { request: { ...request.toObject(), status: 'in_review' }, ticketId },
      'Request submitted successfully',
      201
    );
  } catch (err) {
    console.error('createRequest error:', err);
    return errorResponse(res, 'Failed to create request', 500);
  }
};

const getMyRequests = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = { student: req.user._id, isDeleted: false };
    if (req.query.status) filter.status = req.query.status;

    const [requests, total] = await Promise.all([
      Request.find(filter)
        .populate('category', 'name code icon')
        .populate('school', 'name code')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Request.countDocuments(filter),
    ]);

    return successResponse(res, {
      requests,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return errorResponse(res, 'Failed to fetch requests', 500);
  }
};

const getRequestById = async (req, res) => {
  try {
    const request = await Request.findOne({ _id: req.params.id, student: req.user._id, isDeleted: false })
      .populate('category', 'name code icon')
      .populate('school', 'name code');

    if (!request) return errorResponse(res, 'Request not found', 404);

    // handoverNote is written for the next process owner only and is promised
    // as private to them, so it never goes out on a student-facing response.
    const stages = await WorkflowStage.find({ request: request._id })
      .select('-handoverNote -handoverFrom -escalationRecipients')
      .sort({ stageIndex: 1 });

    return successResponse(res, { request, stages });
  } catch (err) {
    return errorResponse(res, 'Failed to fetch request', 500);
  }
};

const getRequestByTicketId = async (req, res) => {
  try {
    const request = await Request.findOne({
      ticketId: req.params.ticketId,
      student: req.user._id,
      isDeleted: false,
    })
      .populate('category', 'name code icon')
      .populate('school', 'name code');

    if (!request) return errorResponse(res, 'Request not found', 404);

    // handoverNote is written for the next process owner only and is promised
    // as private to them, so it never goes out on a student-facing response.
    const stages = await WorkflowStage.find({ request: request._id })
      .select('-handoverNote -handoverFrom -escalationRecipients')
      .sort({ stageIndex: 1 });

    return successResponse(res, { request, stages });
  } catch (err) {
    return errorResponse(res, 'Failed to fetch request', 500);
  }
};

const adminGetAllRequests = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = { isDeleted: false };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.school) filter.school = req.query.school;

    const [requests, total] = await Promise.all([
      Request.find(filter)
        .populate('student', 'name email rollNumber')
        .populate('category', 'name code')
        .populate('school', 'name code')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Request.countDocuments(filter),
    ]);

    return successResponse(res, {
      requests,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    return errorResponse(res, 'Failed to fetch requests', 500);
  }
};

const adminDeleteDemoRequests = async (req, res) => {
  try {
    const DEMO_EMAIL = 'demo@onestop.mru.edu.in';
    const User = require('../models/User');
    const WorkflowStage = require('../models/WorkflowStage');
    const ApprovalToken = require('../models/ApprovalToken');
    const Notification = require('../models/Notification');
    const AuditLog = require('../models/AuditLog');

    const demo = await User.findOne({ email: DEMO_EMAIL });
    if (!demo) return errorResponse(res, 'Demo user not found', 404);

    const requests = await Request.find({ student: demo._id });
    const requestIds = requests.map(r => r._id);

    if (requestIds.length > 0) {
      await Promise.all([
        WorkflowStage.deleteMany({ request: { $in: requestIds } }),
        ApprovalToken.deleteMany({ request: { $in: requestIds } }),
        Notification.deleteMany({ request: { $in: requestIds } }),
        AuditLog.deleteMany({ request: { $in: requestIds } }),
        Request.deleteMany({ student: demo._id }),
      ]);
    }

    return successResponse(res, { deleted: requestIds.length });
  } catch (err) {
    return errorResponse(res, 'Failed to delete demo requests', 500);
  }
};

module.exports = {
  createRequest,
  getMyRequests,
  getRequestById,
  getRequestByTicketId,
  adminGetAllRequests,
  adminDeleteDemoRequests,
};
