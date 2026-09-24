const Setting = require('../models/Setting');
const { INTAKE_EMAIL, INTAKE_LABEL } = require('../config/intake');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// ── Default escalation settings ──
const DEFAULT_ESCALATION = {
  enabled: true,
  recipientEmail: '',
  recipientLabel: 'Vice Chancellor',
  afterHours: 24,
};

// GET /api/settings/features — public, no auth required
const getFeatures = async (req, res) => {
  try {
    const doc = await Setting.findOne({ key: 'features' });
    // Fail open. Student services are live, so a missing settings document must
    // not read as "disabled" — the mobile app would show "Coming Soon" to every
    // user. Turning the feature off is an explicit admin action via PATCH.
    const features = doc?.value ?? { studentServicesEnabled: true };
    return successResponse(res, { features }, 'Features fetched');
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

    const doc = await Setting.findOneAndUpdate(
      { key: 'features' },
      { value: { studentServicesEnabled } },
      { upsert: true, new: true }
    );

    return successResponse(res, { features: doc.value }, 'Features updated');
  } catch (err) {
    return errorResponse(res, 'Failed to update features', 500);
  }
};

// GET /api/settings/routing — admin only. Lets the dashboard show where
// requests actually land instead of duplicating the constant.
const getRouting = async (req, res) =>
  successResponse(res, { routing: { intakeEmail: INTAKE_EMAIL, intakeLabel: INTAKE_LABEL } }, 'Routing fetched');

// ── Escalation settings ──

/** Read the saved escalation config; merge with defaults so new fields are safe. */
const getEscalationConfig = async () => {
  const doc = await Setting.findOne({ key: 'escalation' });
  return { ...DEFAULT_ESCALATION, ...(doc?.value || {}) };
};

// GET /api/settings/escalation — admin only
const getEscalation = async (req, res) => {
  try {
    const escalation = await getEscalationConfig();
    return successResponse(res, { escalation }, 'Escalation settings fetched');
  } catch (err) {
    return errorResponse(res, 'Failed to fetch escalation settings', 500);
  }
};

// PATCH /api/settings/escalation — admin only
const updateEscalation = async (req, res) => {
  try {
    const { enabled, recipientEmail, recipientLabel, afterHours } = req.body;

    // Validate
    if (enabled !== undefined && typeof enabled !== 'boolean') {
      return errorResponse(res, 'enabled must be a boolean', 400);
    }
    if (afterHours !== undefined && (typeof afterHours !== 'number' || afterHours < 1 || afterHours > 720)) {
      return errorResponse(res, 'afterHours must be a number between 1 and 720', 400);
    }
    if (recipientEmail !== undefined && typeof recipientEmail !== 'string') {
      return errorResponse(res, 'recipientEmail must be a string', 400);
    }

    const current = await getEscalationConfig();
    const updated = {
      enabled: enabled !== undefined ? enabled : current.enabled,
      recipientEmail: recipientEmail !== undefined ? recipientEmail.trim().toLowerCase() : current.recipientEmail,
      recipientLabel: recipientLabel !== undefined ? String(recipientLabel).trim() : current.recipientLabel,
      afterHours: afterHours !== undefined ? afterHours : current.afterHours,
    };

    const doc = await Setting.findOneAndUpdate(
      { key: 'escalation' },
      { value: updated },
      { upsert: true, new: true }
    );

    return successResponse(res, { escalation: doc.value }, 'Escalation settings updated');
  } catch (err) {
    return errorResponse(res, 'Failed to update escalation settings', 500);
  }
};

module.exports = { getFeatures, updateFeatures, getRouting, getEscalation, updateEscalation, getEscalationConfig };
