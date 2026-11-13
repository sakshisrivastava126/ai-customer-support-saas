import { AppError } from '../utils/AppError.js';

export function requireRole(...allowedRoles) {
  if (allowedRoles.length === 0) throw new Error('requireRole needs at least one role');

  return (req, res, next) => {
    if (!req.user) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    if (!allowedRoles.includes(req.user.role)) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission to perform this action');
    }
    next();
  };
}
