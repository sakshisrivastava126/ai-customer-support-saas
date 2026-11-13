import { rateLimit } from 'express-rate-limit';
import { AppError } from '../utils/AppError.js';

const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_MAX_REQUESTS = 10;

function rejectAsRateLimited(req, res, next) {
  next(new AppError(429, 'RATE_LIMITED', 'Too many requests, please try again later'));
}

export const authLimiter = rateLimit({
  windowMs: AUTH_WINDOW_MS,
  limit: AUTH_MAX_REQUESTS,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rejectAsRateLimited,
});
