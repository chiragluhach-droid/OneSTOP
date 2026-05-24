require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const path = require('path');
const XLSX = require('xlsx');
const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const School = require('../models/School');
const Category = require('../models/Category');
const User = require('../models/User');
const Request = require('../models/Request');
const WorkflowStage = require('../models/WorkflowStage');
const ApprovalToken = require('../models/ApprovalToken');
const ApprovalAction = require('../models/ApprovalAction');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');

const log     = (msg) => console.log(`  ✓ ${msg}`);
const section = (msg) => console.log(`\n── ${msg} ──`);

// Maps Excel department string → school code
const DEPT_TO_SCHOOL = {
  'Dept of Computer Science & Technology': 'SOE',
  'Dept of Electronics and Communication': 'SOE',
  'Dept of Mechanical Engineering':        'SOE',
  'Department of Law':                     'SOL',
  'MRU-Department of Management & Human':  'SOB',
  'Department of Education':               'SEH',
  'Department of Chemistry':               'SOS',
  'Department of Mathematics':             'SOS',
  'Department of Physics':                 'SOS',
};

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('\n🌱 OneSTOP Seed Script — Manav Rachna University\n');

  // ── Wipe entire database ──
  section('Clearing database');
  await Promise.all([
    School.deleteMany({}),
    Category.deleteMany({}),
    User.deleteMany({}),
    Admin.deleteMany({}),
    Request.deleteMany({}),
    WorkflowStage.deleteMany({}),
    ApprovalToken.deleteMany({}),
    ApprovalAction.deleteMany({}),
    Notification.deleteMany({}),
    AuditLog.deleteMany({}),
  ]);
  log('Entire database cleared');

  // ── Admin ──
  section('Admin');
  const adminEmail    = process.env.ADMIN_EMAIL    || 'luhachchirag@gmail.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123secure';
  await Admin.create({ name: 'OneSTOP Admin', email: adminEmail, password: adminPassword, role: 'superadmin' });
  log(`Admin created: ${adminEmail}`);

  // ── Schools ──
  section('Schools');
  const schoolDefs = [
    { name: 'School of Engineering',            code: 'SOE', description: 'Engineering and Technology',     deanEmail: 'deanengg@mru.edu.in' },
    { name: 'School of Business',               code: 'SOB', description: 'Business and Management',       deanEmail: 'deanmgt@mru.edu.in' },
    { name: 'School of Law',                    code: 'SOL', description: 'Law and Legal Studies',         deanEmail: 'dean.law@mru.edu.in' },
    { name: 'School of Education & Humanities', code: 'SEH', description: 'Education and Humanities',     deanEmail: 'deaneducation@mru.edu.in' },
    { name: 'School of Sciences',               code: 'SOS', description: 'Sciences and Research',         deanEmail: 'deansciences@mru.edu.in' },
  ];

  const schoolDocs = {};
  for (const s of schoolDefs) {
    const doc = await School.create(s);
    schoolDocs[s.code] = doc._id;
    log(`${s.code} — ${s.name}`);
  }

  // ── Categories ──
  section('Categories');
  const categoryDefs = [
    { name: 'Library Resource Services',    code: 'LIBRARY', icon: '📚', description: 'Library membership, e-resources login, book issue/return, no-dues, plagiarism/e-database access, remote access issues',              processOwners: ['mamta.deputylibrarian@mru.edu.in'], ccEmails: ['deanacademics@mru.edu.in'] },
    { name: 'Academic Support',             code: 'ACADEMIC', icon: '🎓', description: 'Course registration, elective/core mapping, timetable, mentor coordination, attendance/academic guidance, academic letters',         processOwners: ['deanacademics@mru.edu.in'],          ccEmails: ['deanacademics@mru.edu.in'] },
    { name: 'Department of Student Welfare',code: 'WELFARE',  icon: '🤝', description: 'Clubs/societies, student council, events, discipline support, welfare requests, student engagement permissions',                     processOwners: ['deanstudents@mru.edu.in', 'niharika@mru.edu.in'], ccEmails: ['registrar@mru.edu.in'] },
    { name: 'IT Support',                   code: 'IT',       icon: '💻', description: 'Email ID, ERP/EMS login, Wi-Fi, device/QR attendance, LMS, classroom IT, hardware/software support',                               processOwners: ['gm.it@mru.edu.in', 'damini.ict@mru.edu.in'],      ccEmails: ['registrar@mru.edu.in'] },
    { name: 'Examination Processes',        code: 'EXAM',     icon: '📝', description: 'Exam forms, admit cards/hall tickets, datesheet, rechecking, result/grade card, exam-session issues, backlog/PSC cases',            processOwners: ['deanexam@mru.edu.in', 'dracad@mru.edu.in'],        ccEmails: ['deanacademics@mru.edu.in'] },
    { name: 'Administrative Support',       code: 'ADMIN',    icon: '🏛️', description: 'Bonafide/NOC, infrastructure, ID card, records, student facilitation, campus support, general administration',                     processOwners: ['info@mru.edu.in'],                  ccEmails: ['registrar@mru.edu.in'] },
    { name: 'Career Development Centre',    code: 'CDC',      icon: '🌱', description: 'Aptitude, soft skills, verbal ability, career counselling, employability training, career preparation',                             processOwners: ['director.cdc@mrei.ac.in'],           ccEmails: ['deanacademics@mru.edu.in'] },
    { name: 'Career Resource Centre',       code: 'CRC',      icon: '💼', description: 'Placement registration, recruiter coordination, internships, placement drives, corporate interface, job opportunity support',       processOwners: ['rakhi.crc@mriu.edu.in', 'shalinikhatri.crc@mriu.edu.in'], ccEmails: ['deanacademics@mru.edu.in'] },
    { name: 'International Office',         code: 'INTL',     icon: '🌍', description: 'International collaborations, exchange, foreign university connect, international admissions/support, study/work-away',             processOwners: ['meenakapahi@mru.edu.in', 'jyoti@mru.edu.in'],      ccEmails: ['deanacademics@mru.edu.in'] },
    { name: 'Innovation / IIC / Incubation',code: 'IIC',      icon: '💡', description: 'Startup ideas, IIC activities, incubation support, hackathons, prototypes, patents linkage, innovation mentoring',                 processOwners: ['parneeta.cst@mru.edu.in', 'jpsharma@mru.edu.in'], ccEmails: ['deanacademics@mru.edu.in'] },
  ];

  for (const c of categoryDefs) {
    await Category.create(c);
    log(`${c.icon}  ${c.name}`);
  }

  // ── Manual test students ──
  section('Manual students');
  const soeId = schoolDocs['SOE'];
  await User.create({
    name: 'Chirag Luhach', email: 'chiragluhach@gmail.com',
    rollNumber: 'MRU2024001', school: soeId,
    department: 'Dept of Computer Science & Technology', isActive: true,
  });
  log('Student created: chiragluhach@gmail.com (MRU2024001)');

  await User.create({
    name: 'Chandni Magoo', email: 'chandnimagoo@mru.edu.in',
    rollNumber: 'MRU2024002', school: soeId,
    department: 'Dept of Computer Science & Technology', isActive: true,
  });
  log('Student created: chandnimagoo@mru.edu.in (MRU2024002)');

  // ── Excel students ──
  section('Seeding students from Excel');
  const excelPath = path.join(__dirname, '../../../mru stduents mail ids.xlsx');
  const wb   = XLSX.readFile(excelPath);
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const seenEmails  = new Set(['chiragluhach@gmail.com', 'chandnimagoo@mru.edu.in']);
  const seenRolls   = new Set(['MRU2024001', 'MRU2024002']);
  const batch       = [];
  let skippedDupe   = 0;
  let skippedNoData = 0;

  for (let i = 1; i < rows.length; i++) {
    const row  = rows[i];
    const roll = row[1] ? row[1].toString().trim() : null;
    const dept = row[6] ? row[6].toString().trim() : null;

    if (!roll || !dept) { skippedNoData++; continue; }

    const uniEmail = row[5] ? row[5].toString().toLowerCase().trim() : null;
    if (!uniEmail) { skippedNoData++; continue; }

    if (seenEmails.has(uniEmail) || seenRolls.has(roll)) { skippedDupe++; continue; }

    const schoolCode = DEPT_TO_SCHOOL[dept];
    const schoolId   = schoolCode ? schoolDocs[schoolCode] : null;

    // Prefer col[3] (full name) then col[2] (first name)
    const name = (row[3] && row[3].toString().trim()) || (row[2] && row[2].toString().trim()) || uniEmail.split('@')[0];

    seenEmails.add(uniEmail);
    seenRolls.add(roll);

    batch.push({
      name, email: uniEmail, rollNumber: roll,
      school: schoolId, department: dept, isActive: true,
    });

    if (batch.length === 500) {
      await User.insertMany(batch, { ordered: false });
      process.stdout.write('.');
      batch.length = 0;
    }
  }

  if (batch.length > 0) {
    await User.insertMany(batch, { ordered: false });
    process.stdout.write('.');
  }

  const totalStudents = await User.countDocuments({ role: 'student' });
  console.log('');
  log(`Excel students seeded (skipped ${skippedDupe} dupes, ${skippedNoData} blank rows)`);
  log(`Total students in DB: ${totalStudents}`);

  // ── Summary ──
  console.log('\n' + '─'.repeat(60));
  console.log('🎉  Seed complete!\n');
  console.log(`  Admin Login      →  ${adminEmail}`);
  console.log(`  Admin Password   →  ${adminPassword}`);
  console.log(`  Total Students   →  ${totalStudents}`);
  console.log('─'.repeat(60) + '\n');

  process.exit(0);
};

seed().catch((err) => {
  console.error('\n❌ Seed error:', err.message);
  process.exit(1);
});
