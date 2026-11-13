import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { authLimiter } from '../middleware/rateLimiters.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validate } from '../middleware/validate.js';
import { loginSchema, signupSchema } from '../validators/auth.schemas.js';

const router = Router();

router.post('/signup', authLimiter, validate(signupSchema, 'body'), authController.signup);
router.post('/login', authLimiter, validate(loginSchema, 'body'), authController.login);
router.get('/me', requireAuth, authController.me);

export default router;
