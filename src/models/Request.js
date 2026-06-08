const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema({
  url: { type: String, required: true },
  publicId: { type: String },
  originalName: { type: String },
  mimeType: { type: String },
}, { _id: false });

const requestSchema = new mongoose.Schema(
  {
    ticketId: { type: String, required: true, unique: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    subject: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    attachments: [attachmentSchema],
    status: {
      type: String,
      enum: ['pending', 'in_review', 'approved', 'rejected', 'resolved', 'escalated'],
      default: 'pending',
    },
    currentStageIndex: { type: Number, default: 0 },
    totalStages: { type: Number, default: 4 },
    resolvedAt: { type: Date },
    rejectedAt: { type: Date },
    rejectionReason: { type: String },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

requestSchema.index({ student: 1, createdAt: -1 });
requestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Request', requestSchema);
