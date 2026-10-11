const Request = require('../models/Request');
const WorkflowStage = require('../models/WorkflowStage');
const Category = require('../models/Category');
const School = require('../models/School');
const Notification = require('../models/Notification');
const generateTicketId = require('../utils/generateTicketId');
const { sendApprovalEmail, sendCcFyiEmail } = require('../services/workflowService');
const { resolveRecipients } = require('../utils/recipients');
const { INTAKE_EMAIL, INTAKE_LABEL } = require('../config/intake');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const auditLog = require('../utils/auditLogger');
const { getReopenConfig } = require('./settingController');
const { createIntakeStage } = require('../services/stageFactory');
const { notify, notifyStaffByEmail } = require('../services/notifyService');
const { labelForStage } = require('../services/ownerIdentity');
const { withLinks } = require('../utils/fileLinks');

// Fields a student must never be sent. handoverNote is written for the next
// process owner and promised as private to them.
//
// recipientEmails is NOT excluded here: stages created before `ownerLabel`
// existed need it to resolve a designation on the fly. The serializer below
// strips it after doing so, so it never reaches the client either way.
const STUDENT_STAGE_HIDDEN = '-handoverNote -handoverFrom -escalationRecipients';

/**
 * Stages as the student sees them: signed attachment links, a designation
 * instead of a mailbox, and how long each stage took.
 */
const serializeStagesForStudent = async (stages) =>
  Promise.all(
    stages.map(async (s) => {
      const obj = typeof s.toObject === 'function' ? s.toObject() : { ...s };
      obj.attachments = withLinks(obj.attachments);
      obj.ownerLabel = await labelForStage(obj);
      delete obj.recipientEmails;
      return obj;
    })
  );

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


    // A client that fails to send its file part still delivers the text fields,
    // so the request would otherwise "succeed" with the attachment silently gone.
    // multer leaves a non-file `attachments` value in req.body in that case.
    const attachmentDropped = req.body.attachments !== undefined && !(req.files && req.files.length);
    if (attachmentDropped) {
      console.warn(
        `createRequest: attachment sent but no file received (student ${req.user._id}, content-type "${req.headers['content-type'] || ''}")`
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

    // FYI copies go only to the category's explicit CC list. Nobody is added
    // implicitly — a dean or HOD is copied only if their address was put there.
    const ccEmails = resolveRecipients(category.ccEmails, school);

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
      // The chain length isn't known up front any more — each forward appends
      // a stage, so this grows as the request moves.
      totalStages: 1,
    });

    // A single intake stage on the desk's short clock. Whoever holds the
    // request decides where it goes next by typing an address into the
    // Forward form.
    const intakeStage = await createIntakeStage({ request, category, ccEmails });

    const stages = [intakeStage];

    const isDemo = req.user.email === 'demo@onestop.mru.edu.in';
    if (!isDemo) {
      await sendApprovalEmail({
        request,
        workflowStage: stages[0],
        stageIndex: 0,
        canForward: true,
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



    await notify({
      user: req.user,
      title: 'Request Submitted',
      body: `Your request #${ticketId} has been submitted and is under initial review.`,
      type: 'request_submitted',
      request,
    });

    // The desk is told on its phone as well as by email, so a new concern is
    // visible without anyone having to be at a computer.
    await notifyStaffByEmail(INTAKE_EMAIL, {
      title: 'New Request Received',
      body: `#${ticketId} · ${category.name} — from ${req.user.name}. ${subject.trim()}`,
      type: 'request_received',
      request,
      channelId: 'assignments',
    });

    await auditLog({
      event: 'REQUEST_CREATED',
      actor: req.user._id.toString(),
      actorModel: 'User',
      request: request._id,
      metadata: {
        ticketId,
        category: category.name,
        school: school.name,
        attachmentsReceived: attachments.length,
        attachmentDropped,
        contentType: String(req.headers['content-type'] || '').split(';')[0],
      },
      ipAddress: req.ip,
    });

    return successResponse(
      res,
      { request: request.toObject(), ticketId },
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

    const stages = await WorkflowStage.find({ request: request._id })
      .select(STUDENT_STAGE_HIDDEN)
      .sort({ stageIndex: 1 });

    const reqObj = request.toObject();
    reqObj.attachments = withLinks(reqObj.attachments);
    const stagesObj = await serializeStagesForStudent(stages);

    return successResponse(res, { request: reqObj, stages: stagesObj });
  } catch (err) {
    console.error('getRequestById error:', err);
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

    const stages = await WorkflowStage.find({ request: request._id })
      .select(STUDENT_STAGE_HIDDEN)
      .sort({ stageIndex: 1 });

    const reqObj = request.toObject();
    reqObj.attachments = withLinks(reqObj.attachments);

    return successResponse(res, {
      request: reqObj,
      stages: await serializeStagesForStudent(stages),
    });
  } catch (err) {
    console.error('getRequestByTicketId error:', err);
    return errorResponse(res, 'Failed to fetch request', 500);
  }
};

/**
 * POST /api/requests/:id/reopen
 *
 * A student who isn't satisfied with how their concern was closed sends it
 * back. The request returns to the One Stop desk on a fresh intake stage — so
 * it restarts on the short clock and the desk decides where it goes this time,
 * rather than bouncing straight back to whoever closed it.
 */
const reopenRequest = async (req, res) => {
  try {
    const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
    if (reason.length < 10) {
      return errorResponse(res, 'Please describe what is still unresolved (at least 10 characters).', 400);
    }
    if (reason.length > 2000) {
      return errorResponse(res, 'Please keep your reason under 2000 characters.', 400);
    }

    const policy = await getReopenConfig();
    if (!policy.enabled) {
      return errorResponse(res, 'Reopening requests is currently disabled. Please raise a new request.', 403);
    }

    const request = await Request.findOne({
      _id: req.params.id,
      student: req.user._id,
      isDeleted: false,
    });
    if (!request) return errorResponse(res, 'Request not found', 404);

    if (request.status !== 'resolved') {
      return errorResponse(res, 'Only a resolved request can be reopened.', 400);
    }

    if ((request.reopenCount || 0) >= policy.maxTimes) {
      return errorResponse(
        res,
        `This request has already been reopened ${policy.maxTimes} time${policy.maxTimes === 1 ? '' : 's'}. Please raise a new request.`,
        400
      );
    }

    const closedAt = request.resolvedAt || request.updatedAt;
    const deadline = new Date(closedAt).getTime() + policy.withinDays * 24 * 60 * 60 * 1000;
    if (Date.now() > deadline) {
      return errorResponse(
        res,
        `This request was closed more than ${policy.withinDays} day${policy.withinDays === 1 ? '' : 's'} ago and can no longer be reopened. Please raise a new request.`,
        400
      );
    }

    const [category, school] = await Promise.all([
      Category.findById(request.category),
      School.findById(request.school),
    ]);
    if (!category || !school) return errorResponse(res, 'Request is missing its category or school', 400);

    // Append rather than reuse: the closed stage keeps its resolution and
    // attachments, and the timeline shows the student pushing back.
    const lastStage = await WorkflowStage.findOne({ request: request._id }).sort({ stageIndex: -1 });
    const nextIndex = (lastStage?.stageIndex ?? -1) + 1;

    const stage = await createIntakeStage({
      request,
      category,
      ccEmails: lastStage?.ccEmails || [],
      stageIndex: nextIndex,
      isReopen: true,
    });

    await Request.findByIdAndUpdate(request._id, {
      $set: {
        status: 'pending',
        currentStageIndex: nextIndex,
        totalStages: Math.max(request.totalStages || 1, nextIndex + 1),
        reopenedAt: new Date(),
        // Preserve the original turnaround — resolvedAt is about to be cleared
        // and will be overwritten when this round closes.
        firstResolvedAt: request.firstResolvedAt || request.resolvedAt,
        resolvedAt: null,
        inProgressAt: null,
      },
      $inc: { reopenCount: 1 },
      $push: { reopenHistory: { reason, at: new Date() } },
    });

    // The desk reads the student's own words as the handover note, so the
    // reason for the pushback is the first thing in the email.
    await sendApprovalEmail({
      request,
      workflowStage: stage,
      stageIndex: stage.stageIndex,
      canForward: true,
      student: req.user,
      category,
      school,
      handoverNote:
        `Reopened by the student (attempt ${(request.reopenCount || 0) + 1} of ${policy.maxTimes}) — they are not satisfied with the resolution.\n\n${reason}`,
    });

    await notify({
      user: req.user,
      title: 'Request Reopened',
      body: `Your request #${request.ticketId} has been reopened and sent back to the ${INTAKE_LABEL}.`,
      type: 'request_reopened',
      request,
    });

    await notifyStaffByEmail(INTAKE_EMAIL, {
      title: 'Request Reopened by Student',
      body: `#${request.ticketId} — ${req.user.name} is not satisfied with the resolution. ${reason.slice(0, 140)}`,
      type: 'request_reopened',
      request,
      channelId: 'assignments',
    });

    await auditLog({
      event: 'REQUEST_REOPENED',
      actor: req.user._id.toString(),
      actorModel: 'User',
      request: request._id,
      metadata: {
        ticketId: request.ticketId,
        reopenCount: (request.reopenCount || 0) + 1,
        stageIndex: nextIndex,
      },
      ipAddress: req.ip,
    });

    const updated = await Request.findById(request._id)
      .populate('category', 'name code icon')
      .populate('school', 'name code');

    return successResponse(
      res,
      { request: updated },
      `Request reopened and sent back to the ${INTAKE_LABEL}.`
    );
  } catch (err) {
    console.error('reopenRequest error:', err);
    return errorResponse(res, 'Failed to reopen request', 500);
  }
};

/**
 * GET /api/requests/:id/reopen-eligibility
 * Lets the app show or hide the Reopen button, and say why when it is hidden,
 * without the student having to try and be refused.
 */
const getReopenEligibility = async (req, res) => {
  try {
    const [request, policy] = await Promise.all([
      Request.findOne({ _id: req.params.id, student: req.user._id, isDeleted: false })
        .select('status resolvedAt updatedAt reopenCount'),
      getReopenConfig(),
    ]);
    if (!request) return errorResponse(res, 'Request not found', 404);

    const used = request.reopenCount || 0;
    const closedAt = request.resolvedAt || request.updatedAt;
    const deadline = closedAt
      ? new Date(new Date(closedAt).getTime() + policy.withinDays * 24 * 60 * 60 * 1000)
      : null;

    let canReopen = true;
    let reason = null;

    if (!policy.enabled) {
      canReopen = false;
      reason = 'Reopening is currently disabled.';
    } else if (request.status !== 'resolved') {
      canReopen = false;
      reason = 'This request is still open.';
    } else if (used >= policy.maxTimes) {
      canReopen = false;
      reason = `You have already reopened this ${policy.maxTimes} time${policy.maxTimes === 1 ? '' : 's'}.`;
    } else if (deadline && Date.now() > deadline.getTime()) {
      canReopen = false;
      reason = `The ${policy.withinDays}-day window to reopen has passed.`;
    }

    return successResponse(res, {
      canReopen,
      reason,
      reopensUsed: used,
      reopensAllowed: policy.maxTimes,
      withinDays: policy.withinDays,
      deadline,
    });
  } catch (err) {
    return errorResponse(res, 'Failed to check reopen eligibility', 500);
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

/**
 * Wipe everything the App Store / Play Store review account has raised, so the
 * next reviewer opens a clean app.
 *
 * Deletes by request id rather than by student, so the staff-side notifications
 * about those requests go too — otherwise the One Stop desk is left with alerts
 * that open a ticket which no longer exists.
 */
const adminDeleteDemoRequests = async (req, res) => {
  try {
    const DEMO_EMAIL = 'demo@onestop.mru.edu.in';
    const User = require('../models/User');
    const WorkflowStage = require('../models/WorkflowStage');
    const ApprovalToken = require('../models/ApprovalToken');
    const ApprovalAction = require('../models/ApprovalAction');
    const EscalationResponse = require('../models/EscalationResponse');
    const Notification = require('../models/Notification');
    const AuditLog = require('../models/AuditLog');

    const demo = await User.findOne({ email: DEMO_EMAIL });
    if (!demo) return errorResponse(res, 'Demo user not found', 404);

    const requests = await Request.find({ student: demo._id }).select('_id');
    const requestIds = requests.map((r) => r._id);

    if (requestIds.length > 0) {
      await Promise.all([
        WorkflowStage.deleteMany({ request: { $in: requestIds } }),
        ApprovalToken.deleteMany({ request: { $in: requestIds } }),
        // These two were missing, so a reset left orphaned action and
        // escalation history behind.
        ApprovalAction.deleteMany({ request: { $in: requestIds } }),
        EscalationResponse.deleteMany({ request: { $in: requestIds } }),
        Notification.deleteMany({ request: { $in: requestIds } }),
        AuditLog.deleteMany({ request: { $in: requestIds } }),
        Request.deleteMany({ student: demo._id }),
      ]);
    }

    // Anything else sitting in the reviewer's bell — a broadcast, say — would
    // otherwise survive a "reset" and show up as unread on a fresh install.
    const strayNotifications = await Notification.deleteMany({ user: demo._id });

    return successResponse(res, {
      deleted: requestIds.length,
      notificationsCleared: strayNotifications.deletedCount || 0,
    });
  } catch (err) {
    console.error('adminDeleteDemoRequests error:', err);
    return errorResponse(res, 'Failed to delete demo requests', 500);
  }
};

const adminGetRequestDetail = async (req, res) => {
  try {
    const request = await Request.findById(req.params.id)
      .populate('student', 'name email rollNumber department')
      .populate('category', 'name code icon')
      .populate('school', 'name code');

    if (!request) return errorResponse(res, 'Request not found', 404);

    const stages = await WorkflowStage.find({ request: request._id }).sort({ stageIndex: 1 });

    const { withLinks } = require('../utils/fileLinks');
    const reqObj = request.toObject();
    reqObj.attachments = withLinks(reqObj.attachments);
    const stagesObj = stages.map(s => {
      const obj = s.toObject();
      obj.attachments = withLinks(obj.attachments);
      return obj;
    });

    return successResponse(res, { request: reqObj, stages: stagesObj });
  } catch (err) {
    return errorResponse(res, 'Failed to fetch request detail', 500);
  }
};

module.exports = {
  createRequest,
  getMyRequests,
  getRequestById,
  getRequestByTicketId,
  reopenRequest,
  getReopenEligibility,
  adminGetAllRequests,
  adminDeleteDemoRequests,
  adminGetRequestDetail,
};
