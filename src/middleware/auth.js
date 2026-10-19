const { verifyAccessToken } = require('../services/jwtService');
const { errorResponse } = require('../utils/apiResponse');
const User = require('../models/User');
const Admin = require('../models/Admin');
const Staff = require('../models/Staff');

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

const protectStaff = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 'No token provided', 401);
    }
    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);
    if (!['dsw', 'dean', 'hod', 'staff'].includes(decoded.role)) {
      return errorResponse(res, 'Staff access required', 403);
    }
    const staff = await Staff.findById(decoded.id).select('-otp -otpExpiresAt -refreshToken');
    if (!staff || !staff.isActive) {
      return errorResponse(res, 'Staff not found or inactive', 401);
    }
    req.staff = staff;
    next();
  } catch (err) {
    return errorResponse(res, 'Invalid or expired token', 401);
  }
};

// The two consoles are separate systems, not one with two tiers.
//
//   admin       — runs the university day to day: staff, schools, categories,
//                 settings, the app-version gate, announcements. It owns every
//                 route below.
//   superadmin   — the leadership console. Reads the whole university through
//                 /admin/super-admin/* and changes nothing, so it is turned
//                 away from the operational routes entirely.
//
// Shared session plumbing (logout) uses `protectAdminSession`, which takes
// either, since both roles are Admin documents holding a refresh token.
const loadAdmin = async (req, res, roles) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    errorResponse(res, 'No token provided', 401);
    return null;
  }
  let decoded;
  try {
    decoded = verifyAccessToken(authHeader.split(' ')[1]);
  } catch (err) {
    errorResponse(res, 'Invalid or expired token', 401);
    return null;
  }
  if (!roles.includes(decoded.role)) {
    errorResponse(
      res,
      decoded.role === 'superadmin'
        ? 'The Super Admin console is read-only. Sign in to the admin portal to make changes.'
        : 'Admin access required',
      403
    );
    return null;
  }
  const admin = await Admin.findById(decoded.id).select('-password -refreshToken');
  if (!admin || !admin.isActive) {
    errorResponse(res, 'Admin not found or inactive', 401);
    return null;
  }
  // The token could predate a role change, so trust the stored role.
  if (!roles.includes(admin.role)) {
    errorResponse(res, 'Admin access required', 403);
    return null;
  }
  return admin;
};

const protectAdmin = async (req, res, next) => {
  try {
    const admin = await loadAdmin(req, res, ['admin']);
    if (!admin) return undefined;
    req.admin = admin;
    return next();
  } catch (err) {
    return errorResponse(res, 'Invalid or expired token', 401);
  }
};

/** Either console's own session — used for logout only. */
const protectAdminSession = async (req, res, next) => {
  try {
    const admin = await loadAdmin(req, res, ['admin', 'superadmin']);
    if (!admin) return undefined;
    req.admin = admin;
    return next();
  } catch (err) {
    return errorResponse(res, 'Invalid or expired token', 401);
  }
};

// Accepts either a student token, a staff token, OR an admin token (for shared read routes)
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
    } else if (['dsw', 'dean', 'hod', 'staff'].includes(decoded.role)) {
      const staff = await Staff.findById(decoded.id).select('-otp -otpExpiresAt -refreshToken');
      if (!staff || !staff.isActive) return errorResponse(res, 'Staff not found or inactive', 401);
      req.staff = staff;
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

// Super-admin only. The super-admin console exposes every student record, every
// staff member and every request in the university, so `protectAdmin` is not
// enough here — that one also admits role 'admin'.
const protectSuperAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 'No token provided', 401);
    }
    const decoded = verifyAccessToken(authHeader.split(' ')[1]);
    if (decoded.role !== 'superadmin') {
      return errorResponse(res, 'Super Admin privileges required', 403);
    }
    const admin = await Admin.findById(decoded.id).select('-password -refreshToken');
    if (!admin || !admin.isActive) return errorResponse(res, 'Admin not found or inactive', 401);
    if (admin.role !== 'superadmin') {
      // The token could predate a demotion.
      return errorResponse(res, 'Super Admin privileges required', 403);
    }
    req.admin = admin;
    next();
  } catch (err) {
    return errorResponse(res, 'Invalid or expired token', 401);
  }
};

module.exports = { protect, protectStaff, protectAdmin, protectAdminSession, protectSuperAdmin, protectAny };
