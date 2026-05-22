const Request = require('../models/Request');
const WorkflowStage = require('../models/WorkflowStage');
const Category = require('../models/Category');
const School = require('../models/School');
const Notification = require('../models/Notification');
const generateTicketId = require('../utils/generateTicketId');
const { sendApprovalEmail } = require('../services/workflowService');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const auditLog = require('../utils/auditLogger');

const DEAN_ACADEMICS_EMAIL = 'deanacademics@mru.edu.in';

const createRequest = async (req, res) => {
  try {
    const { categoryId, schoolId, subject, description } = req.body;
    if (!categoryId || !schoolId || !subject || !description) {
      return errorResponse(res, 'All fields are required', 400);
    }

    const [category, school] = await Promise.all([
      Category.findById(categoryId),
      School.findById(schoolId),
    ]);

    if (!category) return errorResponse(res, 'Category not found', 404);
    if (!school) return errorResponse(res, 'School not found', 404);

    const attachments = (req.files || []).map((f) => ({
      url: f.path,
      publicId: f.filename,
      originalName: f.originalname,
      mimeType: f.mimetype,
    }));

    let ticketId = generateTicketId();
    let exists = await Request.findOne({ ticketId });
    while (exists) {
      ticketId = generateTicketId();
      exists = await Request.findOne({ ticketId });
    }

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
      totalStages: 4,
    });

    // Build 4 stages from DB — routing is fully data-driven
    const stageDefinitions = [
      {
        stageIndex: 0,
        stageName: 'Initial Review',
        recipientEmails: category.processOwners,
        ccEmails: category.ccEmails,
      },
      {
        stageIndex: 1,
        stageName: 'HOD Review',
        recipientEmails: school.hodEmail ? [school.hodEmail] : [],
        ccEmails: category.ccEmails,
      },
      {
        stageIndex: 2,
        stageName: 'Dean Review',
        recipientEmails: school.deanEmail ? [school.deanEmail] : [],
        ccEmails: category.ccEmails,
      },
      {
        stageIndex: 3,
        stageName: 'Academic Review',
        recipientEmails: [DEAN_ACADEMICS_EMAIL],
        ccEmails: category.ccEmails,
      },
    ];

    const stages = await WorkflowStage.insertMany(
      stageDefinitions.map((s) => ({ ...s, request: request._id, status: 'pending' }))
    );

    await sendApprovalEmail({
      request,
      workflowStage: stages[0],
      stageIndex: 0,
      isFinalStage: false,
      student: req.user,
      category,
      school,
    });

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

    const stages = await WorkflowStage.find({ request: request._id }).sort({ stageIndex: 1 });

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

    const stages = await WorkflowStage.find({ request: request._id }).sort({ stageIndex: 1 });

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
        .populate('student', 'name email collegeId')
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

module.exports = {
  createRequest,
  getMyRequests,
  getRequestById,
  getRequestByTicketId,
  adminGetAllRequests,
};
