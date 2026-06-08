const mongoose = require('mongoose');
const Admin = require('./src/models/Admin');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function fix() {
  await mongoose.connect(process.env.MONGO_URI);
  let admin = await Admin.findOne({ email: 'luhachchirag@gmail.com' });
  const hash = await bcrypt.hash('admin123secure', 12);
  admin.password = hash;
  
  // temporarily disable pre-save hook for password or just use updateOne
  await Admin.updateOne({ email: 'luhachchirag@gmail.com' }, { password: hash });
  console.log('Admin password hashed and saved!');
  
  process.exit(0);
}
fix();
