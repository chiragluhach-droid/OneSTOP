// Addresses offered in the Forward form's dropdown, so whoever holds a request
// can pick a colleague instead of typing an address. Grouped for scanning; the
// free-text field stays available for anyone not listed.
//
// The Staff collection is the source of truth, because that is what the admin
// dashboard manages — add someone there and they appear here. School.deanEmail
// / hodEmail are folded in afterwards as a supplement, for an address attached
// to a school that has no Staff record of its own.
const Staff = require('../models/Staff');
const School = require('../models/School');
const WorkflowStage = require('../models/WorkflowStage');
const { INTAKE_EMAIL, INTAKE_LABEL } = require('../config/intake');
const { isEmail } = require('../utils/recipients');

const RECENT_LIMIT = 15;

// Group heading per Staff.role, in the order they should appear.
const ROLE_GROUPS = [
  { role: 'dsw', label: 'Student Welfare' },
  { role: 'dean', label: 'Deans' },
  { role: 'hod', label: 'HODs' },
  { role: 'staff', label: 'Directors & Other Staff' },
];

/**
 * @param {string[]} exclude  addresses that must not appear (e.g. the person
 *                            forwarding, and the student)
 * @returns {Promise<Array<{ label: string, options: Array<{ email: string, label: string }> }>>}
 */
const getForwardDirectory = async ({ exclude = [] } = {}) => {
  const seen = new Set(exclude.filter(Boolean).map((e) => String(e).toLowerCase()));

  const take = (email, label) => {
    const clean = String(email || '').trim();
    const key = clean.toLowerCase();
    if (!clean || !isEmail(clean) || seen.has(key)) return null;
    seen.add(key);
    return { email: clean, label: label || clean };
  };

  const [staff, schools] = await Promise.all([
    Staff.find({ isActive: true }).select('name email designation role').sort({ name: 1 }).lean(),
    School.find({ isActive: true }).select('name deanEmail hodEmail').sort({ name: 1 }).lean(),
  ]);

  const groups = [];
  const push = (label, options) => { if (options.length) groups.push({ label, options }); };

  // The intake desk always leads, whether or not it has a Staff record.
  const deskOptions = [take(INTAKE_EMAIL, `${INTAKE_LABEL} (Student Welfare desk)`)].filter(Boolean);

  // Staff names are written as titles ("Dean - School of Engineering",
  // "HOD CST", "Director IQAC"), so they read well on their own. A personal
  // name gets its designation appended so the role is still obvious.
  const labelFor = (s) => {
    const name = (s.name || '').trim();
    const designation = (s.designation || '').trim();
    if (!name) return designation || s.email;
    if (!designation) return name;
    return name.toLowerCase().includes(designation.toLowerCase()) ? name : `${name} (${designation})`;
  };

  for (const { role, label } of ROLE_GROUPS) {
    const options = staff
      .filter((s) => s.role === role)
      .map((s) => take(s.email, labelFor(s)))
      .filter(Boolean);

    if (role === 'dsw') push(label, [...deskOptions, ...options]);
    else push(label, options);
  }

  // The desk had no Staff record of its own, so it never got a group above.
  if (deskOptions.length && !groups.some((g) => g.options.some((o) => o.email === deskOptions[0].email))) {
    groups.unshift({ label: 'Student Welfare', options: deskOptions });
  }

  // Addresses recorded on a school but absent from the staff list.
  const fromSchools = [
    ...schools.map((s) => take(s.deanEmail, `Dean — ${s.name}`)),
    ...schools.map((s) => take(s.hodEmail, `HOD — ${s.name}`)),
  ].filter(Boolean);
  push('Also listed on a school', fromSchools);

  // Addresses requests have already been forwarded to, most recently used
  // first — catches anyone who was typed in by hand and never added as staff.
  const recent = await WorkflowStage.aggregate([
    { $match: { stageIndex: { $gt: 0 } } },
    { $unwind: '$recipientEmails' },
    { $group: { _id: { $toLower: '$recipientEmails' }, last: { $max: '$createdAt' } } },
    { $sort: { last: -1 } },
    { $limit: RECENT_LIMIT * 3 },
  ]);
  push(
    'Recently forwarded to',
    recent.map((r) => take(r._id, r._id)).filter(Boolean).slice(0, RECENT_LIMIT)
  );

  return groups;
};

module.exports = { getForwardDirectory };
