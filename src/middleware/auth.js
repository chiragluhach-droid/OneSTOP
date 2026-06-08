const { verifyAccessToken } = require('../services/jwtService');
const { errorResponse } = require('../utils/apiResponse');
const User = require('../models/User');
const Admin = require('../models/Admin');

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 'No token provided', 401);
    }
    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.id)
      .select('-otp -otpExpiresAt -refreshToken')
      .populate('school', 'name code');
    if (!user || !user.isActive) {
      return errorResponse(res, 'User not found or inactive', 401);
    }
    req.user = user;
    next();
  } catch (err) {
    return errorResponse(res, 'Invalid or expired token', 401);
  }
};

const protectAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 'No token provided', 401);
    }
    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (decoded.role !== 'admin' && decoded.role !== 'superadmin') {
      return errorResponse(res, 'Admin access required', 403);
    }
    const admin = await Admin.findById(decoded.id).select('-password -refreshToken');
    if (!admin || !admin.isActive) {
      return errorResponse(res, 'Admin not found or inactive', 401);
    }
    req.admin = admin;
    next();
  } catch (err) {
    return errorResponse(res, 'Invalid or expired token', 401);
  }
};

// Accepts either a student token OR an admin token (for shared read routes)
const protectAny = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 'No token provided', 401);
    }
    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    if (decoded.role === 'admin' || decoded.role === 'superadmin') {
      const admin = await Admin.findById(decoded.id).select('-password -refreshToken');
      if (!admin || !admin.isActive) return errorResponse(res, 'Admin not found or inactive', 401);
      req.admin = admin;
      req.user = null;
    } else {
      const user = await User.findById(decoded.id)
        .select('-otp -otpExpiresAt -refreshToken')
        .populate('school', 'name code');
      if (!user || !user.isActive) return errorResponse(res, 'User not found or inactive', 401);
      req.user = user;
    }
    next();
  } catch (err) {
    return errorResponse(res, 'Invalid or expired token', 401);
  }
};

module.exports = { protect, protectAdmin, protectAny };
