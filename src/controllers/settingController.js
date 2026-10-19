const Setting = require('../models/Setting');
const { INTAKE_EMAIL, INTAKE_LABEL } = require('../config/intake');
const { DEFAULT_INTAKE_HOURS, DEFAULT_FORWARDED_HOURS } = require('../config/sla');
const { DEFAULT_WORKING_TIME } = require('../config/workingTime');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// ── Default escalation / SLA settings ──
// Two clocks: the One Stop desk only triages, so it gets hours; a dean or HOD
// has to actually act, so they get days. `afterHours` is kept because settings
// documents written before the split only carry that one number.
const DEFAULT_ESCALATION = {
  enabled: true,
  recipientEmail: 'deanstudents@mru.edu.in',
  recipientLabel: 'Dean of Student Welfare',
  intakeHours: DEFAULT_INTAKE_HOURS,
  forwardedHours: DEFAULT_FORWARDED_HOURS,
  afterHours: DEFAULT_FORWARDED_HOURS,
  // Route an overdue concern to the holder's own reporting authority (an HOD's
  // dean, say) rather than sending every escalation to the same mailbox.
  reportingChain: true,
  // Reached only when the authority above is itself overdue, so the office at
  // the top hears about exceptions rather than about everything.
  finalAuthorityEmail: '',
  finalAuthorityLabel: 'Vice Chancellor',
};

// ── Working days ──
// Response windows are counted in working time, so a concern raised on Friday
// is not overdue before the university reopens on Monday.
const DEFAULT_WORKING = { ...DEFAULT_WORKING_TIME };

// ── Automatic acknowledgement ──
// Sent to the student the moment a concern reaches the One Stop desk, so
// nobody is left wondering whether their mail arrived.
const DEFAULT_AUTO_REPLY = {
  enabled: true,
  message:
    'Your concern has been received by the One Stop desk and is being processed. '
    + 'You will be notified as soon as there is an update.',
};

// ── Default reopen policy ──
const DEFAULT_REOPEN = {
  enabled: true,
  withinDays: 7,
  maxTimes: 2,
};

// ── Default app-version gate ──
// `minVersion` empty means "no gate" — the app must not lock anyone out just
// because this was never configured.
const DEFAULT_APP_VERSION = {
  minVersion: '',
  enforced: false,
  message: 'A newer version of MR One is required to continue.',
  iosUrl: 'https://apps.apple.com/in/app/mr-one-manav-rachna/id6772509561',
  androidUrl: 'https://play.google.com/store/apps/details?id=com.mru.onestop',
};

const readConfig = async (key, defaults) => {
  const doc = await Setting.findOne({ key });
  return { ...defaults, ...(doc?.value || {}) };
};

const writeConfig = async (key, value) => {
  const doc = await Setting.findOneAndUpdate({ key }, { value }, { upsert: true, new: true });
  return doc.value;
};

const getEscalationConfig = () => readConfig('escalation', DEFAULT_ESCALATION);
const getReopenConfig = () => readConfig('reopen', DEFAULT_REOPEN);
const getAppVersionConfig = () => readConfig('appVersion', DEFAULT_APP_VERSION);
const getWorkingTimeConfig = () => readConfig('workingTime', DEFAULT_WORKING);
const getAutoReplyConfig = () => readConfig('autoReply', DEFAULT_AUTO_REPLY);

// ── Feature flags (public read) ──

// GET /api/settings/features — public, no auth required
const getFeatures = async (req, res) => {
  try {
    const [doc, appVersion] = await Promise.all([
      Setting.findOne({ key: 'features' }),
      getAppVersionConfig(),
    ]);
    // Fail open. Student services are live, so a missing settings document must
    // not read as "disabled" — the mobile app would show "Coming Soon" to every
    // user. Turning the feature off is an explicit admin action via PATCH.
    const features = doc?.value ?? { studentServicesEnabled: true };
    // Rides along on the one endpoint the app can already reach before login
    // and that is exempt from rate limiting, so the version gate can be
    // evaluated on a cold start with no session.
    return successResponse(res, { features, appVersion }, 'Features fetched');
  } catch (err) {
    return errorResponse(res, 'Failed to fetch features', 500);
  }
};

// PATCH /api/settings/features — admin only
const updateFeatures = async (req, res) => {
  try {
    const { studentServicesEnabled } = req.body;
    if (typeof studentServicesEnabled !== 'boolean') {
      return errorResponse(res, 'studentServicesEnabled must be a boolean', 400);
    }

    const value = await writeConfig('features', { studentServicesEnabled });
    return successResponse(res, { features: value }, 'Features updated');
  } catch (err) {
    return errorResponse(res, 'Failed to update features', 500);
  }
};

// GET /api/settings/routing — admin only. Lets the dashboard show where
// requests actually land instead of duplicating the constant.
const getRouting = async (req, res) =>
  successResponse(res, { routing: { intakeEmail: INTAKE_EMAIL, intakeLabel: INTAKE_LABEL } }, 'Routing fetched');

// ── Escalation / SLA settings ──

// GET /api/settings/escalation — admin only
const getEscalation = async (req, res) => {
  try {
    const escalation = await getEscalationConfig();
    return successResponse(res, { escalation }, 'Escalation settings fetched');
  } catch (err) {
    return errorResponse(res, 'Failed to fetch escalation settings', 500);
  }
};

const hoursError = (name, value) =>
  value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value < 1 || value > 720)
    ? `${name} must be a number between 1 and 720`
    : null;

// PATCH /api/settings/escalation — admin only
const updateEscalation = async (req, res) => {
  try {
    const {
      enabled, recipientEmail, recipientLabel, intakeHours, forwardedHours,
      reportingChain, finalAuthorityEmail, finalAuthorityLabel,
    } = req.body;

    if (enabled !== undefined && typeof enabled !== 'boolean') {
      return errorResponse(res, 'enabled must be a boolean', 400);
    }
    const badHours = hoursError('intakeHours', intakeHours) || hoursError('forwardedHours', forwardedHours);
    if (badHours) return errorResponse(res, badHours, 400);
    if (recipientEmail !== undefined && typeof recipientEmail !== 'string') {
      return errorResponse(res, 'recipientEmail must be a string', 400);
    }
    if (reportingChain !== undefined && typeof reportingChain !== 'boolean') {
      return errorResponse(res, 'reportingChain must be a boolean', 400);
    }
    if (finalAuthorityEmail !== undefined && typeof finalAuthorityEmail !== 'string') {
      return errorResponse(res, 'finalAuthorityEmail must be a string', 400);
    }

    const current = await getEscalationConfig();
    const updated = {
      enabled: enabled !== undefined ? enabled : current.enabled,
      recipientEmail: recipientEmail !== undefined ? recipientEmail.trim().toLowerCase() : current.recipientEmail,
      recipientLabel: recipientLabel !== undefined ? String(recipientLabel).trim() : current.recipientLabel,
      intakeHours: intakeHours !== undefined ? intakeHours : current.intakeHours,
      forwardedHours: forwardedHours !== undefined ? forwardedHours : current.forwardedHours,
      // Kept in step with the forwarded window so anything still reading the
      // old single-value field behaves sensibly.
      afterHours: forwardedHours !== undefined ? forwardedHours : current.forwardedHours,
      reportingChain: reportingChain !== undefined ? reportingChain : current.reportingChain,
      finalAuthorityEmail: finalAuthorityEmail !== undefined
        ? finalAuthorityEmail.trim().toLowerCase()
        : current.finalAuthorityEmail,
      finalAuthorityLabel: finalAuthorityLabel !== undefined
        ? String(finalAuthorityLabel).trim()
        : current.finalAuthorityLabel,
    };

    const value = await writeConfig('escalation', updated);
    return successResponse(res, { escalation: value }, 'Escalation settings updated');
  } catch (err) {
    return errorResponse(res, 'Failed to update escalation settings', 500);
  }
};

// ── Reopen policy ──

// GET /api/settings/reopen — admin only
const getReopen = async (req, res) => {
  try {
    const reopen = await getReopenConfig();
    return successResponse(res, { reopen }, 'Reopen policy fetched');
  } catch (err) {
    return errorResponse(res, 'Failed to fetch reopen policy', 500);
  }
};

// PATCH /api/settings/reopen — admin only
const updateReopen = async (req, res) => {
  try {
    const { enabled, withinDays, maxTimes } = req.body;

    if (enabled !== undefined && typeof enabled !== 'boolean') {
      return errorResponse(res, 'enabled must be a boolean', 400);
    }
    if (withinDays !== undefined && (typeof withinDays !== 'number' || withinDays < 1 || withinDays > 365)) {
      return errorResponse(res, 'withinDays must be a number between 1 and 365', 400);
    }
    if (maxTimes !== undefined && (typeof maxTimes !== 'number' || maxTimes < 1 || maxTimes > 10)) {
      return errorResponse(res, 'maxTimes must be a number between 1 and 10', 400);
    }

    const current = await getReopenConfig();
    const value = await writeConfig('reopen', {
      enabled: enabled !== undefined ? enabled : current.enabled,
      withinDays: withinDays !== undefined ? withinDays : current.withinDays,
      maxTimes: maxTimes !== undefined ? maxTimes : current.maxTimes,
    });

    return successResponse(res, { reopen: value }, 'Reopen policy updated');
  } catch (err) {
    return errorResponse(res, 'Failed to update reopen policy', 500);
  }
};

// ── App version gate ──

// GET /api/settings/app-version — admin only (the app reads it via /features)
const getAppVersion = async (req, res) => {
  try {
    const appVersion = await getAppVersionConfig();
    return successResponse(res, { appVersion }, 'App version settings fetched');
  } catch (err) {
    return errorResponse(res, 'Failed to fetch app version settings', 500);
  }
};

const VERSION_RE = /^\d+(\.\d+){0,3}$/;

// PATCH /api/settings/app-version — admin only
const updateAppVersion = async (req, res) => {
  try {
    const { minVersion, enforced, message, iosUrl, androidUrl } = req.body;

    if (minVersion !== undefined) {
      if (typeof minVersion !== 'string') return errorResponse(res, 'minVersion must be a string', 400);
      const trimmed = minVersion.trim();
      if (trimmed && !VERSION_RE.test(trimmed)) {
        return errorResponse(res, 'minVersion must look like 1.0.9', 400);
      }
    }
    if (enforced !== undefined && typeof enforced !== 'boolean') {
      return errorResponse(res, 'enforced must be a boolean', 400);
    }
    for (const [name, val] of [['iosUrl', iosUrl], ['androidUrl', androidUrl]]) {
      if (val !== undefined && typeof val !== 'string') {
        return errorResponse(res, `${name} must be a string`, 400);
      }
      if (val && !/^https:\/\//i.test(val.trim())) {
        return errorResponse(res, `${name} must be an https URL`, 400);
      }
    }

    const current = await getAppVersionConfig();
    const nextMin = minVersion !== undefined ? minVersion.trim() : current.minVersion;

    // Locking every user out of an app with no store link to escape to would be
    // unrecoverable without a server change, so refuse the combination.
    const nextEnforced = enforced !== undefined ? enforced : current.enforced;
    if (nextEnforced && !nextMin) {
      return errorResponse(res, 'Set a minimum version before enforcing the update gate', 400);
    }

    const value = await writeConfig('appVersion', {
      minVersion: nextMin,
      enforced: nextEnforced,
      message: message !== undefined ? String(message).trim() : current.message,
      iosUrl: iosUrl !== undefined ? iosUrl.trim() : current.iosUrl,
      androidUrl: androidUrl !== undefined ? androidUrl.trim() : current.androidUrl,
    });

    return successResponse(res, { appVersion: value }, 'App version settings updated');
  } catch (err) {
    return errorResponse(res, 'Failed to update app version settings', 500);
  }
};

// ── Working days ──

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/settings/working-time — admin only
const getWorkingTime = async (req, res) => {
  try {
    const workingTime = await getWorkingTimeConfig();
    return successResponse(res, { workingTime }, 'Working days fetched');
  } catch (err) {
    return errorResponse(res, 'Failed to fetch working days', 500);
  }
};

// PATCH /api/settings/working-time — admin only
const updateWorkingTime = async (req, res) => {
  try {
    const { enabled, workingDays, holidays } = req.body;

    if (enabled !== undefined && typeof enabled !== 'boolean') {
      return errorResponse(res, 'enabled must be a boolean', 400);
    }
    if (workingDays !== undefined) {
      const ok = Array.isArray(workingDays)
        && workingDays.length > 0
        && workingDays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6);
      if (!ok) {
        return errorResponse(res, 'workingDays must be a non-empty array of day numbers (0 Sunday – 6 Saturday)', 400);
      }
    }
    if (holidays !== undefined) {
      const ok = Array.isArray(holidays) && holidays.every((d) => typeof d === 'string' && DATE_RE.test(d));
      if (!ok) return errorResponse(res, 'holidays must be an array of YYYY-MM-DD dates', 400);
    }

    const current = await getWorkingTimeConfig();
    const value = await writeConfig('workingTime', {
      ...current,
      enabled: enabled !== undefined ? enabled : current.enabled,
      workingDays: workingDays !== undefined ? [...new Set(workingDays)].sort() : current.workingDays,
      holidays: holidays !== undefined ? [...new Set(holidays)].sort() : current.holidays,
    });

    return successResponse(res, { workingTime: value }, 'Working days updated');
  } catch (err) {
    return errorResponse(res, 'Failed to update working days', 500);
  }
};

// ── Automatic acknowledgement ──

// GET /api/settings/auto-reply — admin only
const getAutoReply = async (req, res) => {
  try {
    const autoReply = await getAutoReplyConfig();
    return successResponse(res, { autoReply }, 'Auto-reply fetched');
  } catch (err) {
    return errorResponse(res, 'Failed to fetch auto-reply', 500);
  }
};

// PATCH /api/settings/auto-reply — admin only
const updateAutoReply = async (req, res) => {
  try {
    const { enabled, message } = req.body;

    if (enabled !== undefined && typeof enabled !== 'boolean') {
      return errorResponse(res, 'enabled must be a boolean', 400);
    }
    if (message !== undefined && (typeof message !== 'string' || message.trim().length < 10 || message.length > 1000)) {
      return errorResponse(res, 'message must be between 10 and 1000 characters', 400);
    }

    const current = await getAutoReplyConfig();
    const value = await writeConfig('autoReply', {
      enabled: enabled !== undefined ? enabled : current.enabled,
      message: message !== undefined ? message.trim() : current.message,
    });

    return successResponse(res, { autoReply: value }, 'Auto-reply updated');
  } catch (err) {
    return errorResponse(res, 'Failed to update auto-reply', 500);
  }
};

module.exports = {
  getFeatures, updateFeatures,
  getRouting,
  getEscalation, updateEscalation, getEscalationConfig,
  getReopen, updateReopen, getReopenConfig,
  getAppVersion, updateAppVersion, getAppVersionConfig,
  getWorkingTime, updateWorkingTime, getWorkingTimeConfig,
  getAutoReply, updateAutoReply, getAutoReplyConfig,
};
