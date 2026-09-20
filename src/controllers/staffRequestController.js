const Request = require('../models/Request');
const WorkflowStage = require('../models/WorkflowStage');
const ApprovalAction = require('../models/ApprovalAction');
const Notification = require('../models/Notification');
const User = require('../models/User');
const Category = require('../models/Category');
const School = require('../models/School');
const { sendEmail } = require('../services/emailService');
const { sendApprovalEmail, sendCcFyiEmail } = require('../services/workflowService');
const { buildStudentNotificationEmail } = require('../templates/studentNotificationEmail');
const { getForwardDirectory } = require('../services/staffDirectory');
const { uploadFiles, deleteFiles } = require('../services/fileStorage');
const { withLinks } = require('../utils/fileLinks');
const { isEmail } = require('../utils/recipients');
const auditLog = require('../utils/auditLogger');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// Get requests pending for this staff member
const getMyQueue = async (req, res) => {
  try {
    const email = req.staff.email;
    const stages = await WorkflowStage.find({
      recipientEmails: email,
      status: 'pending'
    }).populate('request');

    // Filter to only those where the request's current stage matches this one
    // (i.e. it hasn't been bypassed or closed unexpectedly)
    const validStages = stages.filter(s => s.request && s.request.currentStageIndex === s.stageIndex && !['resolved', 'rejected'].includes(s.request.status));
    const requestIds = validStages.map(s => s.request._id);

    const requests = await Request.find({ _id: { $in: requestIds } })
      .populate('student', 'name email rollNumber')
      .populate('category', 'name code icon')
      .populate('school', 'name code')
      .sort({ createdAt: -1 });

    return successResponse(res, { requests });
  } catch (err) {
    console.error('getQueue error:', err);
    return errorResponse(res, 'Failed to fetch queue', 500);
  }
};

// DSW can see all requests
const getAllRequests = async (req, res) => {
  try {
    if (req.staff.role !== 'dsw') {
      return errorResponse(res, 'Forbidden: DSW only', 403);
    }
    
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
    return errorResponse(res, 'Failed to fetch all requests', 500);
  }
};

const getRequestDetail = async (req, res) => {
  try {
    const request = await Request.findById(req.params.id)
      .populate('student', 'name email rollNumber department')
      .populate('category', 'name code icon')
      .populate('school', 'name code');

    if (!request) return errorResponse(res, 'Request not found', 404);

    const stages = await WorkflowStage.find({ request: request._id }).sort({ stageIndex: 1 });
    
    // Filter out handoverNote for stages the staff isn't involved in
    // Only the recipient of a stage or the DSW can see the handover notes
    const sanitizedStages = stages.map(s => {
      const obj = s.toObject();
      const isOwner = obj.recipientEmails.includes(req.staff.email) || obj.handoverFrom === req.staff.email;
      if (!isOwner && req.staff.role !== 'dsw') {
        delete obj.handoverNote;
      }
      return obj;
    });

    const { withLinks } = require('../utils/fileLinks');
    const reqObj = request.toObject();
    reqObj.attachments = withLinks(reqObj.attachments);
    const stagesObj = sanitizedStages.map(obj => {
      obj.attachments = withLinks(obj.attachments);
      return obj;
    });

    return successResponse(res, { request: reqObj, stages: stagesObj });
  } catch (err) {
    return errorResponse(res, 'Failed to fetch request detail', 500);
  }
};

const getDirectory = async (req, res) => {
  try {
    // We pass req.staff.email to exclude it from the options
    const directory = await getForwardDirectory({ exclude: [req.staff.email] });
    return successResponse(res, { directory });
  } catch (err) {
    return errorResponse(res, 'Failed to fetch directory', 500);
  }
};

// Common action handler logic extracted from approvalController
const staffAction = async (req, res) => {
  const { id } = req.params;
  const { act } = req.body;
  const actorEmail = req.staff.email;

  if (!['resolved', 'forward', 'in_progress'].includes(act)) {
    return errorResponse(res, 'Invalid action', 400);
  }

  let resolutionAttachments = [];
  let attachmentsSaved = false;

  try {
    const request = await Request.findById(id);
    if (!request) return errorResponse(res, 'Request not found', 404);

    if (['resolved', 'rejected'].includes(request.status)) {
      return errorResponse(res, 'This request has already been closed.', 400);
    }

    const workflowStage = await WorkflowStage.findOne({
      request: request._id,
      stageIndex: request.currentStageIndex
    });

    if (!workflowStage) return errorResponse(res, 'Active stage not found', 404);

    if (!workflowStage.recipientEmails.includes(actorEmail)) {
      return errorResponse(res, 'You are not assigned to the current active stage.', 403);
    }

    const remarks = typeof req.body.remarks === 'string' ? req.body.remarks.trim() : '';
    const handoverNote = typeof req.body.handoverNote === 'string' ? req.body.handoverNote.trim() : '';
    const forwardTo = typeof req.body.forwardTo === 'string' ? req.body.forwardTo.trim().toLowerCase() : '';
    const chosenFiles = act === 'resolved' ? (req.files || []) : [];

    // Validation
    if (act === 'resolved' && !remarks) {
      return errorResponse(res, 'Message to student is required to resolve.', 400);
    }
    
    let nextOwnerEmail = null;
    const student = await User.findById(request.student);
    if (act === 'forward') {
      if (!forwardTo) return errorResponse(res, 'Enter the email address to forward this request to.', 400);
      if (!isEmail(forwardTo)) return errorResponse(res, `"${forwardTo}" is not a valid email address.`, 400);
      if (forwardTo === actorEmail.toLowerCase()) return errorResponse(res, 'That is your own address.', 400);
      if (student && forwardTo === student.email.toLowerCase()) return errorResponse(res, 'That is the student\'s own address.', 400);
      nextOwnerEmail = forwardTo;
    }

    if (chosenFiles.length) {
      try {
        resolutionAttachments = await uploadFiles(chosenFiles, 'onestop/resolutions');
      } catch (err) {
        return errorResponse(res, 'Files could not be uploaded.', 500);
      }
    }

    const [category, school] = await Promise.all([
      Category.findById(request.category),
      School.findById(request.school),
    ]);

    // IN PROGRESS
    if (act === 'in_progress') {
      if (workflowStage.status !== 'pending') {
        return errorResponse(res, 'This stage has already been actioned.', 400);
      }
      
      const now = new Date();
      await WorkflowStage.findByIdAndUpdate(workflowStage._id, {
        inProgressAt: now,
        remarks: remarks ? `In progress — ${remarks}` : 'In progress — being worked on, will be resolved soon.',
      });
      await Request.findByIdAndUpdate(request._id, {
        status: 'in_progress',
        inProgressAt: now,
      });

      await ApprovalAction.create({
        request: request._id,
        workflowStage: workflowStage._id,
        actorEmail,
        stageName: workflowStage.stageName,
        stageIndex: workflowStage.stageIndex,
        action: 'in_progress',
        remarks: remarks || null,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      await Notification.create({
        user: student._id,
        title: 'Request In Progress',
        body: `Your request #${request.ticketId} is being worked on and will be resolved soon.${remarks ? ' ' + remarks : ''}`,
        type: 'request_in_progress',
        request: request._id,
      });

      await sendEmail({
        to: student.email,
        subject: `[MR One] Your request #${request.ticketId} — In Progress`,
        htmlContent: buildStudentNotificationEmail({
          studentName: student.name,
          ticketId: request.ticketId,
          status: 'in_progress',
          remarks,
          stageName: workflowStage.stageName,
        }),
      });

      await sendCcFyiEmail({
        request, workflowStage, student, category, school, excludeActor: actorEmail,
        event: { type: 'in_progress', subjectLabel: 'In Progress', actorEmail, remarks, nextOwnerEmail: null },
      });

      await auditLog({
        event: 'STAFF_IN_PROGRESS',
        actor: req.staff._id.toString(),
        actorModel: 'Staff',
        request: request._id,
        metadata: { stageIndex: workflowStage.stageIndex, stageName: workflowStage.stageName, remarks },
        ipAddress: req.ip,
      });

      return successResponse(res, {}, 'Marked in-progress and student notified.');
    }

    // RESOLVE OR FORWARD
    const stageStatus = act === 'resolved' ? 'approved_final' : 'approved_forwarded';
    const requestStatus = act === 'resolved' ? 'resolved' : 'in_progress';

    await WorkflowStage.findByIdAndUpdate(workflowStage._id, {
      status: stageStatus,
      actionTakenAt: new Date(),
      remarks: remarks || workflowStage.remarks || null,
      ...(resolutionAttachments.length ? { attachments: resolutionAttachments } : {}),
    });
    attachmentsSaved = true;

    await ApprovalAction.create({
      request: request._id,
      workflowStage: workflowStage._id,
      actorEmail,
      stageName: workflowStage.stageName,
      stageIndex: workflowStage.stageIndex,
      action: stageStatus,
      remarks: remarks || null,
      handoverNote: handoverNote || null,
      attachments: resolutionAttachments,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    const updateData = { status: requestStatus };
    if (requestStatus === 'resolved') updateData.resolvedAt = new Date();
    if (act === 'forward') {
      updateData.currentStageIndex = workflowStage.stageIndex + 1;
    }
    await Request.findByIdAndUpdate(request._id, updateData);

    if (act === 'forward') {
      const nextStageIndex = workflowStage.stageIndex + 1;
      const nextStage = await WorkflowStage.create({
        request: request._id,
        stageIndex: nextStageIndex,
        stageName: `Forwarded — ${category.name}`,
        recipientEmails: [forwardTo],
        ccEmails: workflowStage.ccEmails || [],
        escalationRecipients: workflowStage.escalationRecipients || [],
        escalateAfterHours: workflowStage.escalateAfterHours,
        handoverNote: handoverNote || undefined,
        handoverFrom: handoverNote ? actorEmail : undefined,
        status: 'pending',
      });

      await Request.findByIdAndUpdate(request._id, {
        totalStages: Math.max(request.totalStages || 1, nextStageIndex + 1),
      });

      // Still send the email with single-use tokens just in case the next person relies on email!
      await sendApprovalEmail({
        request,
        workflowStage: nextStage,
        stageIndex: nextStage.stageIndex,
        canForward: true,
        student,
        category,
        school,
        handoverNote,
      });
    }

    const EVENT_BY_ACTION = {
      forward: { type: 'forwarded', subjectLabel: 'Forwarded' },
      resolved: { type: 'resolved', subjectLabel: 'Resolved' },
    };

    await sendCcFyiEmail({
      request, workflowStage, student, category, school, excludeActor: actorEmail,
      event: { ...EVENT_BY_ACTION[act], actorEmail, remarks, nextOwnerEmail, attachments: withLinks(resolutionAttachments) },
    });

    const notifTitle = requestStatus === 'resolved' ? 'Request Resolved' : 'Request Forwarded';
    const notifBody = requestStatus === 'resolved'
      ? `Your request #${request.ticketId} has been resolved.${remarks ? ' ' + remarks : ''}`
      : `Your request #${request.ticketId} has been forwarded to ${nextOwnerEmail} for review.${remarks ? ' ' + remarks : ''}`;

    await Notification.create({
      user: student._id,
      title: notifTitle,
      body: notifBody,
      type: requestStatus === 'resolved' ? 'request_resolved' : 'stage_approved',
      request: request._id,
    });

    const studentEmailStatus = requestStatus === 'resolved' ? 'resolved' : 'approved_forwarded';
    await sendEmail({
      to: student.email,
      toName: student.name,
      subject: `[MR One] Your request #${request.ticketId} — ${notifTitle}`,
      htmlContent: buildStudentNotificationEmail({
        studentName: student.name,
        ticketId: request.ticketId,
        status: studentEmailStatus,
        remarks,
        stageName: workflowStage.stageName,
        forwardedTo: nextOwnerEmail,
        attachments: withLinks(resolutionAttachments),
      }),
    });

    await auditLog({
      event: `STAFF_${stageStatus.toUpperCase()}`,
      actor: req.staff._id.toString(),
      actorModel: 'Staff',
      request: request._id,
      metadata: { stageIndex: workflowStage.stageIndex, stageName: workflowStage.stageName, action: act, remarks, forwardedTo: nextOwnerEmail || undefined, attachments: resolutionAttachments.length },
      ipAddress: req.ip,
    });

    return successResponse(res, {}, act === 'resolved' ? 'Request resolved successfully.' : `Request forwarded to ${nextOwnerEmail}.`);
  } catch (err) {
    console.error('staffAction error:', err);
    if (resolutionAttachments.length && !attachmentsSaved) await deleteFiles(resolutionAttachments);
    return errorResponse(res, 'An internal error occurred. Please try again.', 500);
  }
};

module.exports = {
  getMyQueue,
  getAllRequests,
  getRequestDetail,
  getDirectory,
  staffAction,
};
