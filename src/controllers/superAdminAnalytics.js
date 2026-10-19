const Request = require('../models/Request');
const WorkflowStage = require('../models/WorkflowStage');
const User = require('../models/User');
const Staff = require('../models/Staff');
const School = require('../models/School');
const Category = require('../models/Category');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const { getEscalationConfig } = require('./settingController');
const { STAGE_KIND, slaHoursFor } = require('../config/sla');

// Analytics the executive console needs that the directory endpoints don't
// cover: movement over time, whether the response windows are actually being
// met, and a CSV a vice-chancellor can take into a meeting.

const MS_HOUR = 1000 * 60 * 60;
const clampDays = (v, fallback) => {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, 7), 365);
};

/**
 * GET /api/admin/super-admin/trends?days=30
 *
 * Raised vs resolved per day, plus the running backlog. Buckets are built in
 * Mongo by date string rather than in Node, so a year of traffic is still one
 * round trip.
 */
const getTrends = async (req, res) => {
  try {
    const days = clampDays(req.query.days, 30);
    const since = new Date(Date.now() - days * 24 * MS_HOUR);
    since.setHours(0, 0, 0, 0);

    const dayKey = (field) => ({
      $dateToString: { format: '%Y-%m-%d', date: `$${field}`, timezone: 'Asia/Kolkata' },
    });

    const [raisedAgg, resolvedAgg, backlogBefore] = await Promise.all([
      Request.aggregate([
        { $match: { isDeleted: false, createdAt: { $gte: since } } },
        { $group: { _id: dayKey('createdAt'), n: { $sum: 1 } } },
      ]),
      Request.aggregate([
        { $match: { isDeleted: false, resolvedAt: { $gte: since } } },
        { $group: { _id: dayKey('resolvedAt'), n: { $sum: 1 } } },
      ]),
      // Everything still open when the window starts, so the backlog line
      // doesn't begin at a misleading zero.
      Request.countDocuments({
        isDeleted: false,
        createdAt: { $lt: since },
        $or: [{ resolvedAt: null }, { resolvedAt: { $gte: since } }],
      }),
    ]);

    const raised = Object.fromEntries(raisedAgg.map((r) => [r._id, r.n]));
    const resolved = Object.fromEntries(resolvedAgg.map((r) => [r._id, r.n]));

    const series = [];
    let backlog = backlogBefore;
    for (let i = 0; i < days; i += 1) {
      const d = new Date(since.getTime() + i * 24 * MS_HOUR);
      const key = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const r = raised[key] || 0;
      const s = resolved[key] || 0;
      backlog += r - s;
      series.push({ date: key, raised: r, resolved: s, backlog: Math.max(0, backlog) });
    }

    const totals = series.reduce(
      (a, p) => ({ raised: a.raised + p.raised, resolved: a.resolved + p.resolved }),
      { raised: 0, resolved: 0 }
    );

    return successResponse(res, {
      days,
      series,
      totals,
      // Positive means the queue grew over the window.
      netChange: totals.raised - totals.resolved,
    });
  } catch (err) {
    console.error('getTrends error:', err);
    return errorResponse(res, 'Failed to build trends', 500);
  }
};

/**
 * GET /api/admin/super-admin/sla
 *
 * Whether the two response windows are being met, split by the desk that owns
 * them. A stage counts as breached when it sat longer than its own window
 * before being actioned — or, if it is still open, longer than its window ago.
 */
const getSlaReport = async (req, res) => {
  try {
    const config = await getEscalationConfig();
    const intakeMs = slaHoursFor(STAGE_KIND.INTAKE, config) * MS_HOUR;
    const forwardedMs = slaHoursFor(STAGE_KIND.FORWARDED, config) * MS_HOUR;

    const stages = await WorkflowStage.find({ emailSentAt: { $ne: null } })
      .select('stageKind stageIndex status emailSentAt inProgressAt actionTakenAt escalatedAt recipientEmails ownerLabel')
      .lean();

    const now = Date.now();
    const bucket = {
      intake: { label: 'One Stop desk', windowHours: intakeMs / MS_HOUR, total: 0, met: 0, breached: 0, open: 0, totalHours: 0 },
      forwarded: { label: 'Deans, HODs & Directors', windowHours: forwardedMs / MS_HOUR, total: 0, met: 0, breached: 0, open: 0, totalHours: 0 },
    };
    const byOwner = new Map();

    for (const st of stages) {
      // Stages predate `stageKind`; index 0 was always the intake desk.
      const kind = st.stageKind || (st.stageIndex === 0 ? 'intake' : 'forwarded');
      const b = bucket[kind];
      if (!b) continue;

      const windowMs = kind === 'intake' ? intakeMs : forwardedMs;
      const started = new Date(st.inProgressAt || st.emailSentAt).getTime();
      const ended = st.actionTakenAt ? new Date(st.actionTakenAt).getTime() : null;
      const elapsed = (ended ?? now) - started;

      b.total += 1;
      b.totalHours += elapsed / MS_HOUR;
      if (ended === null) b.open += 1;
      if (elapsed > windowMs) b.breached += 1; else if (ended !== null) b.met += 1;

      const owner = st.ownerLabel || (st.recipientEmails || [])[0] || 'Unassigned';
      if (!byOwner.has(owner)) byOwner.set(owner, { owner, total: 0, breached: 0, totalHours: 0 });
      const o = byOwner.get(owner);
      o.total += 1;
      o.totalHours += elapsed / MS_HOUR;
      if (elapsed > windowMs) o.breached += 1;
    }

    const shape = (b) => ({
      ...b,
      avgHours: b.total ? Number((b.totalHours / b.total).toFixed(1)) : 0,
      complianceRate: b.total ? Math.round(((b.total - b.breached) / b.total) * 100) : 100,
    });

    const owners = [...byOwner.values()]
      .map((o) => ({
        owner: o.owner,
        total: o.total,
        breached: o.breached,
        avgHours: Number((o.totalHours / o.total).toFixed(1)),
        complianceRate: Math.round(((o.total - o.breached) / o.total) * 100),
      }))
      .sort((a, b) => b.breached - a.breached || b.total - a.total)
      .slice(0, 12);

    const all = {
      total: bucket.intake.total + bucket.forwarded.total,
      breached: bucket.intake.breached + bucket.forwarded.breached,
    };

    return successResponse(res, {
      windows: { intakeHours: bucket.intake.windowHours, forwardedHours: bucket.forwarded.windowHours },
      intake: shape(bucket.intake),
      forwarded: shape(bucket.forwarded),
      overall: {
        total: all.total,
        breached: all.breached,
        complianceRate: all.total ? Math.round(((all.total - all.breached) / all.total) * 100) : 100,
      },
      byOwner: owners,
    });
  } catch (err) {
    console.error('getSlaReport error:', err);
    return errorResponse(res, 'Failed to build the SLA report', 500);
  }
};

// ── CSV export ──────────────────────────────────────────────────────────────

// Excel reads a leading = + - @ as a formula, so any cell starting with one is
// prefixed with a quote. Quotes inside a field are doubled per RFC 4180.
const csvCell = (v) => {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};
const csvRows = (rows) => rows.map((r) => r.map(csvCell).join(',')).join('\r\n');

const sendCsv = (res, filename, rows) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  // BOM so Excel opens UTF-8 names correctly.
  return res.send('﻿' + csvRows(rows));
};

/**
 * GET /api/admin/super-admin/export?dataset=requests|students|staff
 * Streams the current view as CSV for offline reporting.
 */
const exportCsv = async (req, res) => {
  try {
    const dataset = String(req.query.dataset || 'requests');
    const stamp = new Date().toISOString().slice(0, 10);

    if (dataset === 'students') {
      const rows = await User.find({ role: 'student' })
        .select('name email rollNumber department school isActive createdAt')
        .populate('school', 'name code')
        .sort({ name: 1 })
        .lean();
      return sendCsv(res, `mr-one-students-${stamp}.csv`, [
        ['Name', 'Roll Number', 'Email', 'School', 'Department', 'Active', 'Registered'],
        ...rows.map((r) => [
          r.name, r.rollNumber, r.email,
          r.school?.name || '', r.department || '',
          r.isActive ? 'Yes' : 'No',
          r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : '',
        ]),
      ]);
    }

    if (dataset === 'staff') {
      const rows = await Staff.find({}).select('name email designation role isActive createdAt').sort({ role: 1, name: 1 }).lean();
      return sendCsv(res, `mr-one-staff-${stamp}.csv`, [
        ['Name', 'Email', 'Designation', 'Role', 'Active', 'Added'],
        ...rows.map((r) => [
          r.name, r.email, r.designation || '', r.role,
          r.isActive ? 'Yes' : 'No',
          r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : '',
        ]),
      ]);
    }

    const rows = await Request.find({ isDeleted: false })
      .select('ticketId subject status createdAt resolvedAt reopenCount student category school')
      .populate('student', 'name rollNumber email')
      .populate('category', 'name')
      .populate('school', 'name code')
      .sort({ createdAt: -1 })
      .limit(5000)
      .lean();

    return sendCsv(res, `mr-one-requests-${stamp}.csv`, [
      ['Ticket', 'Subject', 'Status', 'Student', 'Roll Number', 'School', 'Category', 'Raised', 'Resolved', 'Hours to Resolve', 'Reopened'],
      ...rows.map((r) => [
        r.ticketId, r.subject, r.status,
        r.student?.name || '', r.student?.rollNumber || '',
        r.school?.name || '', r.category?.name || '',
        r.createdAt ? new Date(r.createdAt).toISOString() : '',
        r.resolvedAt ? new Date(r.resolvedAt).toISOString() : '',
        r.resolvedAt && r.createdAt
          ? ((new Date(r.resolvedAt) - new Date(r.createdAt)) / MS_HOUR).toFixed(1)
          : '',
        r.reopenCount || 0,
      ]),
    ]);
  } catch (err) {
    console.error('exportCsv error:', err);
    return errorResponse(res, 'Failed to build the export', 500);
  }
};

module.exports = { getTrends, getSlaReport, exportCsv };
