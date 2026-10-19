const express = require('express');
const router = express.Router();
const { protectSuperAdmin } = require('../middleware/auth');
const {
  getSuperAdminMetrics,
  getSuperAdminStudents,
  getSuperAdminStudentDetail,
  getSuperAdminStaff,
  getSuperAdminRequests,
  getSuperAdminRequestDetail,
} = require('../controllers/superAdminController');
const { getTrends, getSlaReport, exportCsv } = require('../controllers/superAdminAnalytics');

// Every route here exposes the whole university's data, so the guard is
// super-admin only — `protectAdmin` would also admit role 'admin'.
router.use(protectSuperAdmin);

router.get('/metrics', getSuperAdminMetrics);
router.get('/trends', getTrends);
router.get('/sla', getSlaReport);
router.get('/export', exportCsv);

router.get('/students', getSuperAdminStudents);
router.get('/students/:id', getSuperAdminStudentDetail);
router.get('/staff', getSuperAdminStaff);
router.get('/requests', getSuperAdminRequests);
router.get('/requests/:id', getSuperAdminRequestDetail);

module.exports = router;
