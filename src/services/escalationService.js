const WorkflowStage = require('../models/WorkflowStage');
const Request = require('../models/Request');
const User = require('../models/User');
const Category = require('../models/Category');
const School = require('../models/School');
const { sendEscalationEmail } = require('./workflowService');

// How often to look for overdue stages. Escalation windows are measured in
// hours, so a 15-minute sweep is precise enough and cheap — the query is a
// single indexed scan that normally matches nothing.
const SWEEP_INTERVAL_MS = parseInt(process.env.ESCALATION_SWEEP_MINUTES || '15', 10) * 60 * 1000;

let timer = null;
let running = false;

/**
 * One pass: find pending stages whose escalation window has elapsed and that
 * haven't been escalated yet, then notify their escalation contacts.
 * Each stage escalates at most once — `escalatedAt` is the guard.
 */
const sweepOverdueStages = async () => {
  const now = Date.now();

  const candidates = await WorkflowStage.find({
    status: 'pending',
    escalatedAt: null,
    emailSentAt: { $ne: null },
    escalateAfterHours: { $gt: 0 },
    'escalationRecipients.0': { $exists: true },
  }).limit(200);

  let escalated = 0;

  for (const stage of candidates) {
    const dueAt = new Date(stage.emailSentAt).getTime() + stage.escalateAfterHours * 60 * 60 * 1000;
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

      await sendEscalationEmail({
        request,
        workflowStage: stage,
        student,
        category,
        school,
        hours: stage.escalateAfterHours,
      });

      // Stamped even if every recipient was filtered out, so a stage that can
      // never escalate isn't rescanned forever.
      await WorkflowStage.findByIdAndUpdate(stage._id, { escalatedAt: new Date() });
      escalated += 1;
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
