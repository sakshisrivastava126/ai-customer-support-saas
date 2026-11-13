import { randomInt, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { config } from '../config/env.js';
import { Tenant } from '../models/Tenant.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import {
  emailTakenError,
  hashPassword,
  isDuplicateKeyError,
  toPublicUser,
  verifyPassword,
} from './user.service.js';

const JWT_ALGORITHM = 'HS256';
const ADMIN_ROLE = 'admin';
const TOKEN_ROLES = ['admin', 'user'];
const SLUG_MAX_LENGTH = 40;
const SLUG_SUFFIX_LENGTH = 4;
const SLUG_SEPARATOR = '-';
const SLUG_BASE_MAX_LENGTH = SLUG_MAX_LENGTH - SLUG_SUFFIX_LENGTH - SLUG_SEPARATOR.length;
const SLUG_SUFFIX_ALPHABET = 'abcdefghijklmnopqrstuvwxyz';
const COMBINING_MARKS_PATTERN = /[̀-ͯ]/g;
const NON_SLUG_CHARS_PATTERN = /[^a-z0-9]+/g;
const EDGE_HYPHENS_PATTERN = /^-+|-+$/g;
const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';

const TIMING_EQUALIZER_HASH = await hashPassword(randomUUID());

function invalidCredentialsError() {
  return new AppError(401, 'INVALID_CREDENTIALS', INVALID_CREDENTIALS_MESSAGE);
}

function unauthorizedError() {
  return new AppError(401, 'UNAUTHORIZED', 'Authentication required');
}

export function toPublicTenant(tenant) {
  return {
    id: String(tenant._id),
    name: tenant.name,
    slug: tenant.slug,
    ownerId: String(tenant.ownerId),
    settings: {
      botName: tenant.settings.botName,
      welcomeMessage: tenant.settings.welcomeMessage,
    },
    createdAt: tenant.createdAt,
    updatedAt: tenant.updatedAt,
  };
}

function randomSlugSuffix() {
  let suffix = '';
  for (let i = 0; i < SLUG_SUFFIX_LENGTH; i += 1) {
    suffix += SLUG_SUFFIX_ALPHABET[randomInt(SLUG_SUFFIX_ALPHABET.length)];
  }
  return suffix;
}

function slugBaseFromName(name) {
  return name
    .normalize('NFKD')
    .replace(COMBINING_MARKS_PATTERN, '')
    .toLowerCase()
    .replace(NON_SLUG_CHARS_PATTERN, SLUG_SEPARATOR)
    .replace(EDGE_HYPHENS_PATTERN, '')
    .slice(0, SLUG_BASE_MAX_LENGTH)
    .replace(EDGE_HYPHENS_PATTERN, '');
}

function generateSlug(companyName) {
  const base = slugBaseFromName(companyName);
  const suffix = randomSlugSuffix();
  return base ? `${base}${SLUG_SEPARATOR}${suffix}` : suffix;
}

function signToken(user) {
  return jwt.sign(
    { sub: String(user._id), tenantId: String(user.tenantId), role: user.role },
    config.jwtSecret,
    { algorithm: JWT_ALGORITHM, expiresIn: config.jwtExpiresIn },
  );
}

function buildSession(user, tenant) {
  return { token: signToken(user), user: toPublicUser(user), tenant: toPublicTenant(tenant) };
}

function createTenantWithAdmin({ name, email, passwordHash, companyName }) {
  const tenantId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const slug = generateSlug(companyName);

  return mongoose.connection.transaction(async (session) => {
    const [tenant] = await Tenant.create(
      [{ _id: tenantId, name: companyName, slug, ownerId: userId }],
      { session },
    );
    const [user] = await User.create(
      [{ _id: userId, tenantId, name, email, passwordHash, role: ADMIN_ROLE }],
      { session },
    );
    return { tenant, user };
  });
}

async function createTenantWithAdminRetryingSlug(input) {
  try {
    return await createTenantWithAdmin(input);
  } catch (err) {
    if (!isDuplicateKeyError(err, 'slug')) throw err;
    return createTenantWithAdmin(input);
  }
}

export async function signup({ name, email, password, companyName }) {
  const passwordHash = await hashPassword(password);
  try {
    const { user, tenant } = await createTenantWithAdminRetryingSlug({
      name,
      email,
      passwordHash,
      companyName,
    });
    return buildSession(user, tenant);
  } catch (err) {
    if (isDuplicateKeyError(err, 'email')) throw emailTakenError();
    throw err;
  }
}

export async function login({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash');
  const passwordMatches = await verifyPassword(
    password,
    user?.passwordHash ?? TIMING_EQUALIZER_HASH,
  );
  if (!user || !passwordMatches) throw invalidCredentialsError();

  const tenant = await Tenant.findOne({ _id: user.tenantId });
  if (!tenant) throw invalidCredentialsError();

  return buildSession(user, tenant);
}

export async function getCurrentSession(tenantId, userId) {
  const [user, tenant] = await Promise.all([
    User.findOne({ _id: userId, tenantId }),
    Tenant.findOne({ _id: tenantId }),
  ]);
  if (!user || !tenant) throw unauthorizedError();
  return { user: toPublicUser(user), tenant: toPublicTenant(tenant) };
}

function isValidTokenPayload(payload) {
  return (
    mongoose.isObjectIdOrHexString(payload?.sub) &&
    mongoose.isObjectIdOrHexString(payload?.tenantId) &&
    TOKEN_ROLES.includes(payload?.role)
  );
}

export function authenticateToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret, { algorithms: [JWT_ALGORITHM] });
  } catch {
    throw unauthorizedError();
  }
  if (!isValidTokenPayload(payload)) throw unauthorizedError();
  return { id: payload.sub, tenantId: payload.tenantId, role: payload.role };
}
