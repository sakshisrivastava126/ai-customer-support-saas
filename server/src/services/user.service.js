import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';

const BCRYPT_COST = 12;
const DUPLICATE_KEY_ERROR_CODE = 11000;
const STAFF_ROLE = 'user';

export function toPublicUser(user) {
  return {
    id: String(user._id),
    tenantId: String(user.tenantId),
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_COST);
}

export function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

export function isDuplicateKeyError(err, field) {
  return err?.code === DUPLICATE_KEY_ERROR_CODE && Boolean(err.keyPattern?.[field]);
}

export function emailTakenError() {
  return new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
}

export async function createStaffUser(tenantId, { name, email, password }) {
  const passwordHash = await hashPassword(password);
  try {
    const user = await User.create({ tenantId, name, email, passwordHash, role: STAFF_ROLE });
    return toPublicUser(user);
  } catch (err) {
    if (isDuplicateKeyError(err, 'email')) throw emailTakenError();
    throw err;
  }
}
