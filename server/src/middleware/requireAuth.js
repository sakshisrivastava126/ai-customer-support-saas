import { authenticateToken } from '../services/auth.service.js';
import { AppError } from '../utils/AppError.js';

const BEARER_TOKEN_PATTERN = /^Bearer\s+(\S+)$/i;

export function requireAuth(req, res, next) {
  const match = BEARER_TOKEN_PATTERN.exec(req.get('authorization') ?? '');
  if (!match) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  req.user = authenticateToken(match[1]);
  next();
}
