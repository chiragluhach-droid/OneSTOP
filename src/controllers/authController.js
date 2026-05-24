const User = require('../models/User');
const generateOtp = require('../utils/generateOtp');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../services/jwtService');
const { sendEmail } = require('../services/emailService');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const auditLog = require('../utils/auditLogger');

const OTP_EXPIRES_MINUTES = 10;
const OTP_RESEND_COOLDOWN_SECONDS = 60;

const userPayload = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  rollNumber: user.rollNumber,
  department: user.department,
  school: user.school ? { _id: user.school._id, name: user.school.name, code: user.school.code } : null,
});

const sendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return errorResponse(res, 'Email is required', 400);

    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return errorResponse(res, 'You are not registered in the system. Please contact admin.', 404);
    }

    if (user.lastOtpSentAt) {
      const secondsSinceLast = (Date.now() - new Date(user.lastOtpSentAt).getTime()) / 1000;
      if (secondsSinceLast < OTP_RESEND_COOLDOWN_SECONDS) {
        return errorResponse(
          res,
          `Please wait ${Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - secondsSinceLast)}s before requesting another OTP`,
          429
        );
      }
    }

    const otp = generateOtp();
    user.otp = otp;
    user.otpExpiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000);
    user.otpAttempts = 0;
    user.lastOtpSentAt = new Date();
    await user.save();

    await sendEmail({
      to: normalizedEmail,
      toName: user.name,
      subject: 'Your OneSTOP Login OTP',
      htmlContent: buildOtpEmail(user.name, otp),
    });

    return successResponse(res, { email: normalizedEmail }, 'OTP sent successfully');
  } catch (err) {
    console.error('sendOtp error:', err);
    return errorResponse(res, 'Failed to send OTP', 500);
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return errorResponse(res, 'Email and OTP are required', 400);

    const user = await User.findOne({ email: email.toLowerCase().trim() }).populate('school', 'name code');
    if (!user) return errorResponse(res, 'User not found', 404);

    if (!user.otp || !user.otpExpiresAt) {
      return errorResponse(res, 'No OTP requested. Please request a new one.', 400);
    }

    if (user.otpAttempts >= 5) {
      return errorResponse(res, 'Too many failed attempts. Request a new OTP.', 429);
    }

    if (new Date() > user.otpExpiresAt) {
      return errorResponse(res, 'OTP has expired. Please request a new one.', 400);
    }

    if (user.otp !== otp.toString()) {
      user.otpAttempts += 1;
      await user.save();
      return errorResponse(res, 'Invalid OTP', 400);
    }

    user.otp = undefined;
    user.otpExpiresAt = undefined;
    user.otpAttempts = 0;

    const accessToken = signAccessToken({ id: user._id, role: 'student' });
    const refreshToken = signRefreshToken({ id: user._id, role: 'student' });
    user.refreshToken = refreshToken;
    await user.save();

    await auditLog({
      event: 'USER_LOGIN',
      actor: user._id.toString(),
      actorModel: 'User',
      metadata: { email: user.email },
      ipAddress: req.ip,
    });

    return successResponse(res, {
      accessToken,
      refreshToken,
      user: userPayload(user),
    }, 'Login successful');
  } catch (err) {
    console.error('verifyOtp error:', err);
    return errorResponse(res, 'OTP verification failed', 500);
  }
};

const refreshTokens = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return errorResponse(res, 'Refresh token required', 400);

    const decoded = verifyRefreshToken(refreshToken);
    const user = await User.findById(decoded.id).populate('school', 'name code');
    if (!user || user.refreshToken !== refreshToken) {
      return errorResponse(res, 'Invalid refresh token', 401);
    }

    const newAccessToken = signAccessToken({ id: user._id, role: 'student' });
    const newRefreshToken = signRefreshToken({ id: user._id, role: 'student' });
    user.refreshToken = newRefreshToken;
    await user.save();

    return successResponse(res, { accessToken: newAccessToken, refreshToken: newRefreshToken }, 'Tokens refreshed');
  } catch (err) {
    return errorResponse(res, 'Invalid or expired refresh token', 401);
  }
};

const logout = async (req, res) => {
  try {
    req.user.refreshToken = undefined;
    await req.user.save();
    return successResponse(res, {}, 'Logged out successfully');
  } catch (err) {
    return errorResponse(res, 'Logout failed', 500);
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name, expoPushToken } = req.body;
    const user = req.user;

    if (name) user.name = name.trim();
    if (expoPushToken) user.expoPushToken = expoPushToken;

    await user.save();
    return successResponse(res, { user: userPayload(user) }, 'Profile updated');
  } catch (err) {
    return errorResponse(res, 'Profile update failed', 500);
  }
};

const getMe = async (req, res) => {
  return successResponse(res, { user: userPayload(req.user) });
};

const buildOtpEmail = (name, otp) => `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:30px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.1);">
        <tr><td style="background:#8B1A1A;padding:24px 32px;">
          <h1 style="margin:0;color:#fff;font-size:22px;">OneSTOP</h1>
          <p style="margin:4px 0 0;color:#f5c6c6;font-size:13px;">Manav Rachna University</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0;font-size:16px;color:#222;">Hi ${name || 'Student'},</p>
          <p style="margin:12px 0;font-size:14px;color:#555;">Your OneSTOP login OTP is:</p>
          <div style="text-align:center;padding:24px;background:#fdf5f5;border-radius:8px;margin:20px 0;">
            <span style="font-size:42px;font-weight:700;color:#8B1A1A;letter-spacing:8px;">${otp}</span>
          </div>
          <p style="font-size:13px;color:#888;">This OTP expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
        </td></tr>
        <tr><td style="background:#f8f8f8;padding:16px 32px;border-top:1px solid #eee;">
          <p style="margin:0;font-size:12px;color:#aaa;text-align:center;">OneSTOP — Manav Rachna University</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

module.exports = { sendOtp, verifyOtp, refreshTokens, logout, updateProfile, getMe };
