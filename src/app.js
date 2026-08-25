require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const connectDB = require('./config/db');

const authRoutes = require('./routes/auth');
const adminAuthRoutes = require('./routes/adminAuth');
const schoolRoutes = require('./routes/schools');
const categoryRoutes = require('./routes/categories');
const requestRoutes = require('./routes/requests');
const approvalRoutes = require('./routes/approvals');
const notificationRoutes = require('./routes/notifications');
const adminStudentRoutes = require('./routes/adminStudents');
const settingRoutes = require('./routes/settings');
const { startEscalationSweeper } = require('./services/escalationService');

const app = express();

// In Kubernetes the app sits behind an ingress that sets X-Forwarded-For.
// express-rate-limit v7 validates this and throws
// ERR_ERL_UNEXPECTED_X_FORWARDED_FOR when Express doesn't trust the proxy,
// which surfaces as an unhandled rejection and kills the process on boot.
// '1' = trust exactly one proxy hop; don't use `true`, which lets a client
// spoof X-Forwarded-For and bypass rate limiting entirely.
app.set('trust proxy', 1);

connectDB();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'] }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, message: 'Too many requests, please try again later.' },
  // The public feature-flag read is exempt. It is keyed by IP like everything
  // else here, so on campus WiFi or carrier NAT a whole cohort shares one
  // 200-request budget; once it runs out this endpoint 429s, and the shipped
  // mobile app treats any failed read as "feature disabled" and shows its
  // "Coming Soon" dialog. Those builds cannot be patched, so the endpoint has
  // to stay reachable. It is an unauthenticated single indexed findOne with no
  // side effects, so it is not worth rationing.
  skip: (req) => req.method === 'GET' && req.originalUrl.startsWith('/api/settings/features'),
});

// Key OTP throttling by email rather than IP. Students share public IPs behind
// campus WiFi and carrier NAT, so an IP-keyed bucket lets the first 10 logins in
// a window lock out everyone else on the same network. Per-account abuse is
// still covered by OTP_RESEND_COOLDOWN_SECONDS in sendOtp, and globalLimiter
// above remains the per-IP backstop for floods of unknown addresses.
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many OTP requests.' },
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : '';
    return email || req.ip;
  },
});

app.use('/api', globalLimiter);
app.use('/api/auth/send-otp', otpLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/schools', schoolRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin/students', adminStudentRoutes);
app.use('/api/settings', settingRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.get('/ready', async (req, res) => {
  const checks = {};

  checks.mongo = mongoose.connection.readyState === 1 ? 'ok' : 'unavailable';

  const allOk = Object.values(checks).every((v) => v === 'ok');
  res.status(allOk ? 200 : 503).json({ status: allOk ? 'ready' : 'not ready', checks });
});

app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`MR One backend running on port ${PORT}`);
  startEscalationSweeper();
});

module.exports = app;
