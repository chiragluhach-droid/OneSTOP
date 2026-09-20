require('dotenv').config();
const mongoose = require('mongoose');
const Staff = require('./src/models/Staff');

const createStaff = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');
    
    const email = 'chiragluhach@gmail.com';
    let staff = await Staff.findOne({ email });
    
    if (staff) {
      console.log('Staff already exists!');
    } else {
      staff = await Staff.create({
        name: 'Chirag (HOD Test)',
        email: email,
        role: 'hod',
        isActive: true,
      });
      console.log('Created Staff:', staff);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

createStaff();
