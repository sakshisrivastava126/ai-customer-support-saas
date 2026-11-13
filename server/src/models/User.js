import mongoose from 'mongoose';

const USER_NAME_MAX_LENGTH = 100;
const USER_ROLES = ['admin', 'user'];

const userSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    name: { type: String, required: true, maxlength: USER_NAME_MAX_LENGTH },
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, required: true },
  },
  { timestamps: true },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ tenantId: 1 });

export const User = mongoose.model('User', userSchema);
