const Admin = require('../models/Admin');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../services/jwtService');
const { successResponse, errorResponse } = require('../utils/apiResponse');

const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return errorResponse(res, 'Email and password required', 400);

    const admin = await Admin.findOne({ email: email.toLowerCase().trim() });
    if (!admin || !admin.isActive) return errorResponse(res, 'Invalid credentials', 401);

    const isValid = await admin.comparePassword(password);
    if (!isValid) return errorResponse(res, 'Invalid credentials', 401);

    const accessToken = signAccessToken({ id: admin._id, role: admin.role });
    const refreshToken = signRefreshToken({ id: admin._id, role: admin.role });
    admin.refreshToken = refreshToken;
    await admin.save();

    return successResponse(res, {
      accessToken,
      refreshToken,
      admin: { _id: admin._id, name: admin.name, email: admin.email, role: admin.role },
    }, 'Admin login successful');
  } catch (err) {
    return errorResponse(res, 'Login failed', 500);
  }
};

const adminRefresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return errorResponse(res, 'Refresh token required', 400);

    const decoded = verifyRefreshToken(refreshToken);
    const admin = await Admin.findById(decoded.id);
    if (!admin || admin.refreshToken !== refreshToken) {
      return errorResponse(res, 'Invalid refresh token', 401);
    }

    const newAccessToken = signAccessToken({ id: admin._id, role: admin.role });
    const newRefreshToken = signRefreshToken({ id: admin._id, role: admin.role });
    admin.refreshToken = newRefreshToken;
    await admin.save();

    return successResponse(res, { accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) {
    return errorResponse(res, 'Invalid or expired refresh token', 401);
  }
};

const adminLogout = async (req, res) => {
  try {
    req.admin.refreshToken = undefined;
    await req.admin.save();
    return successResponse(res, {}, 'Logged out');
  } catch (err) {
    return errorResponse(res, 'Logout failed', 500);
  }
};

module.exports = { adminLogin, adminRefresh, adminLogout };
