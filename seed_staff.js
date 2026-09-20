require('dotenv').config();
const mongoose = require('mongoose');
const Staff = require('./src/models/Staff');
const School = require('./src/models/School');

const seedStaffFromSchools = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const schools = await School.find();
    let addedCount = 0;

    for (const school of schools) {
      // Add Dean
      if (school.deanEmail) {
        const existingDean = await Staff.findOne({ email: school.deanEmail.toLowerCase().trim() });
        if (!existingDean) {
          await Staff.create({
            name: `Dean - ${school.name}`,
            email: school.deanEmail,
            role: 'dean',
            designation: 'Dean',
            isActive: true,
          });
          console.log(`Added Dean: ${school.deanEmail}`);
          addedCount++;
        }
      }

      // Add HOD
      if (school.hodEmail) {
        const existingHod = await Staff.findOne({ email: school.hodEmail.toLowerCase().trim() });
        if (!existingHod) {
          await Staff.create({
            name: `HOD - ${school.name}`,
            email: school.hodEmail,
            role: 'hod',
            designation: 'HOD',
            isActive: true,
          });
          console.log(`Added HOD: ${school.hodEmail}`);
          addedCount++;
        }
      }
    }

    console.log(`Finished seeding. Added ${addedCount} staff members.`);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

seedStaffFromSchools();
