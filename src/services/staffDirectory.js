// Addresses offered in the Forward form's dropdown, so staff can pick a dean or
// HOD instead of typing it. Grouped for scanning; the free-text field stays
// available for anyone not listed.
const School = require('../models/School');
const WorkflowStage = require('../models/WorkflowStage');
const { INTAKE_EMAIL, INTAKE_LABEL } = require('../config/intake');
const { isEmail } = require('../utils/recipients');

const RECENT_LIMIT = 15;

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
    return { email: clean, label };
  };

  const schools = await School.find({ isActive: true })
    .select('name deanEmail hodEmail')
    .sort({ name: 1 })
    .lean();

  const groups = [];

  const desk = take(INTAKE_EMAIL, `${INTAKE_LABEL} (Student Welfare desk)`);
  if (desk) groups.push({ label: 'Student Welfare', options: [desk] });

  const deans = schools.map((s) => take(s.deanEmail, `Dean — ${s.name}`)).filter(Boolean);
  if (deans.length) groups.push({ label: 'Deans', options: deans });

  const hods = schools.map((s) => take(s.hodEmail, `HOD — ${s.name}`)).filter(Boolean);
  if (hods.length) groups.push({ label: 'HODs', options: hods });

  // Addresses requests have already been forwarded to (e.g. department HODs not
  // yet recorded on a school), most recently used first.
  const recent = await WorkflowStage.aggregate([
    { $match: { stageIndex: { $gt: 0 } } },
    { $unwind: '$recipientEmails' },
    { $group: { _id: { $toLower: '$recipientEmails' }, last: { $max: '$createdAt' } } },
    { $sort: { last: -1 } },
    { $limit: RECENT_LIMIT * 3 },
  ]);
  const recentOptions = recent
    .map((r) => take(r._id, r._id))
    .filter(Boolean)
    .slice(0, RECENT_LIMIT);
  if (recentOptions.length) groups.push({ label: 'Recently forwarded to', options: recentOptions });

  return groups;
};

module.exports = { getForwardDirectory };
