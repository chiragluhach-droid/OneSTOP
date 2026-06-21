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

const app = express();

connectDB();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'] }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, message: 'Too many requests, please try again later.' },
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many OTP requests.' },
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

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`OneSTOP backend running on port ${PORT}`);
});

module.exports = app;
