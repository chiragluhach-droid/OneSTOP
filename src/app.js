require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');

const authRoutes = require('./routes/auth');
const adminAuthRoutes = require('./routes/adminAuth');
const schoolRoutes = require('./routes/schools');
const teacherRoutes = require('./routes/teachers');
const categoryRoutes = require('./routes/categories');
const requestRoutes = require('./routes/requests');
const approvalRoutes = require('./routes/approvals');
const notificationRoutes = require('./routes/notifications');

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
app.use('/api/teachers', teacherRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'OneSTOP backend is running', timestamp: new Date().toISOString() });
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
  console.log(`OneSTOP backend running on port ${PORT}`);
});

module.exports = app;
