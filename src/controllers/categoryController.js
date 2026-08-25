const Category = require('../models/Category');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// Accepts either a real array or a comma-separated string, so the admin UI and
// any hand-rolled request both work.
const toArray = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val.map((v) => String(v).trim()).filter(Boolean);
  return String(val).split(',').map((v) => v.trim()).filter(Boolean);
};

const normaliseEscalation = (raw) => {
  if (!raw || typeof raw !== 'object') return undefined;

  const hours = parseInt(raw.afterHours, 10);
  return {
    enabled: Boolean(raw.enabled),
    afterHours: Number.isFinite(hours) && hours > 0 ? hours : 48,
    recipients: toArray(raw.recipients),
  };
};

const getCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({ name: 1 });
    return successResponse(res, { categories });
  } catch (err) {
    return errorResponse(res, 'Failed to fetch categories', 500);
  }
};

const createCategory = async (req, res) => {
  try {
    const { name, code, description, icon, processOwners, ccEmails, escalation } = req.body;
    if (!name || !code) return errorResponse(res, 'Name and code required', 400);

    const category = await Category.create({
      name: name.trim(),
      code: code.toUpperCase().trim(),
      description,
      icon,
      processOwners: toArray(processOwners),
      ccEmails: toArray(ccEmails),
      escalation: normaliseEscalation(escalation),
    });
    return successResponse(res, { category }, 'Category created', 201);
  } catch (err) {
    if (err.code === 11000) return errorResponse(res, 'Category already exists', 409);
    return errorResponse(res, 'Failed to create category', 500);
  }
};

const updateCategory = async (req, res) => {
  try {
    const update = { ...req.body };
    if (update.processOwners !== undefined) update.processOwners = toArray(update.processOwners);
    if (update.ccEmails !== undefined) update.ccEmails = toArray(update.ccEmails);

    if (update.escalation !== undefined) {
      const normalised = normaliseEscalation(update.escalation);
      if (normalised) update.escalation = normalised;
      else delete update.escalation;
    }

    const category = await Category.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });
    if (!category) return errorResponse(res, 'Category not found', 404);
    return successResponse(res, { category }, 'Category updated');
  } catch (err) {
    return errorResponse(res, 'Failed to update category', 500);
  }
};

const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!category) return errorResponse(res, 'Category not found', 404);
    return successResponse(res, {}, 'Category deactivated');
  } catch (err) {
    return errorResponse(res, 'Failed to delete category', 500);
  }
};

module.exports = { getCategories, createCategory, updateCategory, deleteCategory };
