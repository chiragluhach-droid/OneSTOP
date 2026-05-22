const mongoose = require('mongoose');
const Admin = require('./src/models/Admin');
require('dotenv').config();

async function list() {
  await mongoose.connect(process.env.MONGO_URI);
  const admins = await Admin.find({});
  console.log('Admins:', admins.map(a => ({ email: a.email, role: a.role, passHash: a.password })));
  process.exit(0);
}
list();
