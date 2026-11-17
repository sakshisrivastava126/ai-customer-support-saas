import mongoose from 'mongoose';

const MESSAGE_ROLES = ['user', 'assistant'];
const FEEDBACK_VALUES = ['up', 'down', null];
const DEFAULT_FEEDBACK = null;

const sourceSchema = new mongoose.Schema(
  {
    n: { type: Number },
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
    documentName: { type: String },
    page: { type: Number },
    score: { type: Number },
  },
  { _id: false },
);

const messageSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    role: { type: String, enum: MESSAGE_ROLES, required: true },
    content: { type: String, required: true },
    query: { type: String },
    rewrittenQuery: { type: String },
    sources: { type: [sourceSchema], default: undefined },
    answered: { type: Boolean },
    feedback: { type: String, enum: FEEDBACK_VALUES, default: DEFAULT_FEEDBACK },
    feedbackAt: { type: Date },
    latencyMs: { type: Number },
  },
  { timestamps: true },
);

messageSchema.index({ conversationId: 1, createdAt: 1 });
messageSchema.index({ tenantId: 1, answered: 1, createdAt: -1 });

export const Message = mongoose.model('Message', messageSchema);
