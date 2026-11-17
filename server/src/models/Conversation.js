import mongoose from 'mongoose';

const MAX_TITLE_LENGTH = 80;

const conversationSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    visitorId: { type: String, required: true },
    title: { type: String, maxlength: MAX_TITLE_LENGTH },
    messageCount: { type: Number, default: 0 },
    unansweredCount: { type: Number, default: 0 },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

conversationSchema.index({ tenantId: 1, lastMessageAt: -1, unansweredCount: 1 });

export const Conversation = mongoose.model('Conversation', conversationSchema);
