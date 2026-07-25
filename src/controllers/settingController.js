const Setting = require('../models/Setting');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// GET /api/settings/features — public, no auth required
const getFeatures = async (req, res) => {
  try {
    const doc = await Setting.findOne({ key: 'features' });
    const features = doc?.value ?? { studentServicesEnabled: false };
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
