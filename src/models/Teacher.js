const mongoose = require('mongoose');

const teacherSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    designation: { type: String, required: true, trim: true },
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

teacherSchema.index({ school: 1, isActive: 1 });

module.exports = mongoose.model('Teacher', teacherSchema);
