import { Router } from 'express';
import * as usersController from '../controllers/users.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import { createUserSchema } from '../validators/users.schemas.js';

const router = Router();

router.post(
  '/',
  requireAuth,
  requireRole('admin'),
  validate(createUserSchema, 'body'),
  usersController.createUser,
);

export default router;
