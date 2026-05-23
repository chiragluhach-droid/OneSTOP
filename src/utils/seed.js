require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const School = require('../models/School');
const Category = require('../models/Category');
const Teacher = require('../models/Teacher');
const User = require('../models/User');
const Request = require('../models/Request');
const WorkflowStage = require('../models/WorkflowStage');
const ApprovalToken = require('../models/ApprovalToken');
const ApprovalAction = require('../models/ApprovalAction');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');

const log = (msg) => console.log(`  ✓ ${msg}`);
const section = (msg) => console.log(`\n── ${msg} ──`);

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('\n🌱 OneSTOP Seed Script — Manav Rachna University\n');

  // ── Wipe entire database (fresh start) ──
  section('Clearing database');
  await Promise.all([
    School.deleteMany({}),
    Category.deleteMany({}),
    Teacher.deleteMany({}),
    Request.deleteMany({}),
    WorkflowStage.deleteMany({}),
    ApprovalToken.deleteMany({}),
    ApprovalAction.deleteMany({}),
    Notification.deleteMany({}),
    AuditLog.deleteMany({}),
    User.deleteMany({}),
    Admin.deleteMany({}),
  ]);
  log('Entire database cleared');

  // ── Admin (create fresh) ──
  section('Admin');
  const adminEmail = process.env.ADMIN_EMAIL || 'luhachchirag@gmail.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123secure';
  await Admin.create({
    name: 'OneSTOP Admin',
    email: adminEmail,
    password: adminPassword,
    role: 'superadmin',
  });
  log(`Admin created: ${adminEmail}`);

  // ── Student (create fresh) ──
  section('Student');
  await User.create({
    name: 'Chirag Luhach',
    email: 'chiragluhach@gmail.com',
    collegeId: 'MRU2024001',
    phone: '9876543210',
    department: 'Computer Science & Engineering',
    year: 2,
    role: 'student',
    isActive: true,
  });
  log('Student created: chiragluhach@gmail.com');

  // ── Schools ──
  section('Schools');
  const schoolDefs = [
    { name: 'School of Engineering',            code: 'SOE', description: 'Engineering and Technology',   deanEmail: 'deanengg@mru.edu.in' },
    { name: 'School of Business',               code: 'SOB', description: 'Business and Management',     deanEmail: 'deanmgt@mru.edu.in' },
    { name: 'School of Law',                    code: 'SOL', description: 'Law and Legal Studies',       deanEmail: 'dean.law@mru.edu.in' },
    { name: 'School of Education & Humanities', code: 'SEH', description: 'Education and Humanities',   deanEmail: 'deaneducation@mru.edu.in' },
    { name: 'School of Sciences',               code: 'SOS', description: 'Sciences and Research',       deanEmail: 'deansciences@mru.edu.in' },
  ];

  for (const s of schoolDefs) {
    await School.create(s);
    log(`${s.code} — ${s.name}`);
  }

  // ── Categories (from MRU routing matrix) ──
  section('Categories');
  const categoryDefs = [
    {
      name: 'Library Resource Services',
      code: 'LIBRARY',
      description: 'Library membership, e-resources login, book issue/return, no-dues, plagiarism/e-database access, remote access issues',
      icon: '📚',
      processOwners: ['mamta.deputylibrarian@mru.edu.in'],
      ccEmails: ['deanacademics@mru.edu.in'],
    },
    {
      name: 'Academic Support',
      code: 'ACADEMIC',
      description: 'Course registration, elective/core mapping, timetable, mentor coordination, attendance/academic guidance, academic letters, programme/department-level requests',
      icon: '🎓',
      processOwners: ['deanacademics@mru.edu.in'],
      ccEmails: ['deanacademics@mru.edu.in'],
    },
    {
      name: 'Department of Student Welfare',
      code: 'WELFARE',
      description: 'Clubs/societies, student council, events, discipline support, welfare requests, student engagement permissions, society activities',
      icon: '🤝',
      processOwners: ['deanstudents@mru.edu.in', 'niharika@mru.edu.in'],
      ccEmails: ['registrar@mru.edu.in'],
    },
    {
      name: 'IT Support',
      code: 'IT',
      description: 'Email ID, ERP/EMS login, Wi-Fi, device/QR attendance, LMS, classroom IT, hardware/software support, access troubleshooting',
      icon: '💻',
      processOwners: ['gm.it@mru.edu.in', 'damini.ict@mru.edu.in'],
      ccEmails: ['registrar@mru.edu.in'],
    },
    {
      name: 'Examination Processes',
      code: 'EXAM',
      description: 'Exam forms, admit cards/hall tickets, datesheet, rechecking, result/grade card, exam-session issues, backlog/PSC cases',
      icon: '📝',
      processOwners: ['deanexam@mru.edu.in', 'dracad@mru.edu.in'],
      ccEmails: ['deanacademics@mru.edu.in'],
    },
    {
      name: 'Administrative Support',
      code: 'ADMIN',
      description: 'Bonafide/NOC, infrastructure, ID card, records, student facilitation, campus support, general administration',
      icon: '🏛️',
      processOwners: ['info@mru.edu.in'],
      ccEmails: ['registrar@mru.edu.in'],
    },
    {
      name: 'Career Development Centre',
      code: 'CDC',
      description: 'Aptitude, soft skills, verbal ability, career counselling, employability training, career preparation, student readiness programmes',
      icon: '🌱',
      processOwners: ['director.cdc@mrei.ac.in'],
      ccEmails: ['deanacademics@mru.edu.in'],
    },
    {
      name: 'Career Resource Centre',
      code: 'CRC',
      description: 'Placement registration, recruiter coordination, internships, placement drives, corporate interface, job opportunity support',
      icon: '💼',
      processOwners: ['rakhi.crc@mriu.edu.in', 'shalinikhatri.crc@mriu.edu.in'],
      ccEmails: ['deanacademics@mru.edu.in'],
    },
    {
      name: 'International Office',
      code: 'INTL',
      description: 'International collaborations, exchange, foreign university connect, international admissions/support, study/work-away, international student support',
      icon: '🌍',
      processOwners: ['meenakapahi@mru.edu.in', 'jyoti@mru.edu.in'],
      ccEmails: ['deanacademics@mru.edu.in'],
    },
    {
      name: 'Innovation / IIC / Incubation',
      code: 'IIC',
      description: 'Startup ideas, IIC activities, incubation support, hackathons, prototypes, patents linkage, innovation mentoring',
      icon: '💡',
      processOwners: ['parneeta.cst@mru.edu.in', 'jpsharma@mru.edu.in'],
      ccEmails: ['deanacademics@mru.edu.in'],
    },
  ];

  for (const c of categoryDefs) {
    await Category.create(c);
    log(`${c.icon}  ${c.name}`);
  }

  // ── Summary ──
  console.log('\n' + '─'.repeat(60));
  console.log('🎉  Seed complete!\n');
  console.log('  Admin Dashboard  →  http://localhost:3000');
  console.log(`  Admin Login      →  ${adminEmail}`);
  console.log(`  Admin Password   →  ${adminPassword}`);
  console.log('\n  Test Student     →  Chirag Luhach');
  console.log('  Student Email    →  chiragluhach@gmail.com');
  console.log('  College ID       →  MRU2024001');
  console.log('─'.repeat(60) + '\n');

  process.exit(0);
};

seed().catch((err) => {
  console.error('\n❌ Seed error:', err.message);
  process.exit(1);
});
