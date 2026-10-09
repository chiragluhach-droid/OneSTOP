const WorkflowStage = require('../models/WorkflowStage');
const Request = require('../models/Request');
const User = require('../models/User');
const Category = require('../models/Category');
const School = require('../models/School');
const { sendEscalationEmail } = require('./workflowService');
const { getEscalationConfig } = require('../controllers/settingController');
const { STAGE_KIND, slaHoursFor } = require('../config/sla');
const { notifyStaffByEmail } = require('./notifyService');
const { labelForStage } = require('./ownerIdentity');

// How often to look for overdue stages. The shortest window in play is the
// intake desk's few hours, so a 15-minute sweep is precise enough and cheap —
// the query is a single indexed scan that normally matches nothing.
const SWEEP_INTERVAL_MS = parseInt(process.env.ESCALATION_SWEEP_MINUTES || '15', 10) * 60 * 1000;

const BATCH_LIMIT = 200;

let timer = null;
let running = false;

/**
 * The escalation window for a stage, in hours.
 *
 * A stage created since the two-clock split carries its own window, set from
 * the admin settings when the stage was made, and that is honoured as-is.
 * Older stages predate `stageKind` and only ever got a single global number —
 * those fall back to the configured window for their kind, treating stage 0 as
 * the intake desk since that is what it always was.
 */
const windowHoursFor = (stage, config) => {
  if (stage.escalateAfterHours > 0) return stage.escalateAfterHours;

  const kind = stage.stageKind
    || (stage.stageIndex === 0 ? STAGE_KIND.INTAKE : STAGE_KIND.FORWARDED);
  return slaHoursFor(kind, config);
};

/**
 * When this stage's clock last started.
 *
 * The window is there to be satisfied by one of three actions: resolve,
 * forward, or mark in progress. Resolve and forward close the stage, so they
 * take it out of the sweep entirely. Marking in progress deliberately does
 * not — it satisfies the current window and starts a fresh one, so an
 * acknowledged concern that is then abandoned still surfaces, instead of
 * sitting in "being worked on" forever.
 */
const clockStartedAt = (stage) =>
  new Date(stage.inProgressAt || stage.emailSentAt).getTime();

/** Who should be told, for a stage that may have been created before settings existed. */
const recipientsFor = (stage, config) => {
  if (stage.escalationRecipients && stage.escalationRecipients.length) return stage.escalationRecipients;
  if (config.enabled && config.recipientEmail) return [config.recipientEmail];
  return [];
};

/**
 * One pass: find pending stages whose escalation window has elapsed and that
 * haven't been escalated yet, then notify the escalation contact.
 *
 * Each stage escalates at most once — `escalatedAt` is the guard.
 */
const sweepOverdueStages = async () => {
  const now = Date.now();
  const config = await getEscalationConfig();

  const candidates = await WorkflowStage.find({
    status: 'pending',
    escalatedAt: null,
    emailSentAt: { $ne: null },
  }).limit(BATCH_LIMIT);

  let escalated = 0;

  for (const stage of candidates) {
    const hours = windowHoursFor(stage, config);
    if (!hours) continue;

    const dueAt = clockStartedAt(stage) + hours * 60 * 60 * 1000;
    if (now < dueAt) continue;

    try {
      const request = await Request.findById(stage.request);
      // The request may have been closed by another stage, or soft-deleted.
      if (!request || request.isDeleted || ['resolved', 'rejected'].includes(request.status)) {
        await WorkflowStage.findByIdAndUpdate(stage._id, { escalatedAt: new Date() });
        continue;
      }

      const [student, category, school] = await Promise.all([
        User.findById(request.student),
        Category.findById(request.category),
        School.findById(request.school),
      ]);
      if (!student || !category || !school) continue;

      const recipients = recipientsFor(stage, config);
      if (!recipients.length) {
        // Nothing to send and nothing to wait for — stamp it so this stage is
        // not rescanned on every sweep for the rest of its life.
        await WorkflowStage.findByIdAndUpdate(stage._id, { escalatedAt: new Date() });
        continue;
      }

      // Older stages may carry no recipients of their own; hand the sender a
      // stage object that does, without persisting the settings snapshot.
      const stageForEmail = stage.escalationRecipients?.length
        ? stage
        : Object.assign(stage.toObject(), { escalationRecipients: recipients });

      await sendEscalationEmail({
        request,
        workflowStage: stageForEmail,
        student,
        category,
        school,
        hours,
      });

      // Stamped even if every recipient was filtered out (the owner being the
      // escalation contact, say), so a stage that can never escalate isn't
      // rescanned forever.
      await WorkflowStage.findByIdAndUpdate(stage._id, { escalatedAt: new Date() });
      escalated += 1;

      // Push the alert to the escalation contact, and to whoever is sitting on
      // it — a nudge on the phone is what actually gets an overdue concern
      // picked up. Never allowed to fail the sweep.
      const ownerLabel = await labelForStage(stage);
      const summary = `#${request.ticketId} has been waiting ${hours}h with ${ownerLabel}`;
      await Promise.all([
        ...recipients.map((email) => notifyStaffByEmail(email, {
          title: 'Overdue Concern Escalated',
          body: `${summary}. ${student.name} is still waiting.`,
          type: 'request_escalated',
          request,
          channelId: 'escalations',
        })),
        notifyStaffByEmail((stage.recipientEmails || [])[0], {
          title: 'Your Request Is Overdue',
          body: `#${request.ticketId} has passed its ${hours}h window and has been escalated. Please act on it.`,
          type: 'request_escalated',
          request,
          channelId: 'escalations',
        }),
      ]).catch((e) => console.warn('escalation push failed:', e.message || e));
    } catch (err) {
      // Leave escalatedAt unset so the next sweep retries this stage.
      console.error(`Escalation failed for stage ${stage._id}:`, err.message || err);
    }
  }

  return escalated;
};

const runSweep = async () => {
  if (running) return; // A slow sweep must not overlap the next tick.
  running = true;
  try {
    const n = await sweepOverdueStages();
    if (n > 0) console.log(`Escalation sweep: ${n} stage(s) escalated`);
  } catch (err) {
    console.error('Escalation sweep error:', err.message || err);
  } finally {
    running = false;
  }
};

const startEscalationSweeper = () => {
  if (timer) return;
  timer = setInterval(runSweep, SWEEP_INTERVAL_MS);
  if (timer.unref) timer.unref();
  console.log(`Escalation sweeper started (every ${SWEEP_INTERVAL_MS / 60000} min)`);
};

const stopEscalationSweeper = () => {
  if (timer) clearInterval(timer);
  timer = null;
};

module.exports = { startEscalationSweeper, stopEscalationSweeper, sweepOverdueStages, runSweep };
