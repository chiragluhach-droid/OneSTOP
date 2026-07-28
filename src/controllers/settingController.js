const Setting = require('../models/Setting');
const { successResponse, errorResponse } = require('../utils/apiResponse');

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

module.exports = { getFeatures, updateFeatures };
