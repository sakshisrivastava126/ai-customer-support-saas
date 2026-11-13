import mongoose from 'mongoose';

const TENANT_NAME_MAX_LENGTH = 100;
const TENANT_SLUG_PATTERN = /^[a-z0-9-]{3,40}$/;
const DEFAULT_BOT_NAME = 'Support Assistant';
const DEFAULT_WELCOME_MESSAGE = 'Hi! How can I help you today?';

const tenantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: TENANT_NAME_MAX_LENGTH },
    slug: { type: String, required: true, lowercase: true, match: TENANT_SLUG_PATTERN },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    settings: {
      botName: { type: String, default: DEFAULT_BOT_NAME },
      welcomeMessage: { type: String, default: DEFAULT_WELCOME_MESSAGE },
    },
  },
  { timestamps: true },
);

tenantSchema.index({ slug: 1 }, { unique: true });

export const Tenant = mongoose.model('Tenant', tenantSchema);
