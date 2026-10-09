const mongoose = require('mongoose');

const approvalTokenSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true },
    request: { type: mongoose.Schema.Types.ObjectId, ref: 'Request', required: true },
    workflowStage: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkflowStage', required: true },
    stageIndex: { type: Number, required: true },
    isFinalStage: { type: Boolean, default: false },

    // 'action'     — a Resolve / Forward / In Progress button in the stage
    //                owner's email. One use, then it's spent.
    // 'escalation' — the Reply / Forward form in the escalation contact's
    //                email. Reusable, because a VC or Dean who replies may
    //                well want to push it on to the holder as well, and
    //                "this link has already been used" is a poor answer.
    purpose: { type: String, enum: ['action', 'escalation'], default: 'action' },

    useCount: { type: Number, default: 0 },
    maxUses: { type: Number, default: 1 },

    isUsed: { type: Boolean, default: false },
    usedAt: { type: Date },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

approvalTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
approvalTokenSchema.index({ request: 1 });

/** Record one use and flip `isUsed` once the allowance runs out. */
approvalTokenSchema.methods.consume = async function consume() {
  this.useCount = (this.useCount || 0) + 1;
  this.usedAt = new Date();
  if (this.useCount >= (this.maxUses || 1)) this.isUsed = true;
  await this.save();
};

module.exports = mongoose.model('ApprovalToken', approvalTokenSchema);
