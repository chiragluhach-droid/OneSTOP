const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, trim: true },
    hodEmail: { type: String, trim: true },
    deanEmail: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('School', schoolSchema);
