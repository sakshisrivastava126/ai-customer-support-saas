import { Router } from 'express';
import * as chatController from '../controllers/chat.controller.js';
import { chatLimiter } from '../middleware/rateLimiters.js';
import { resolveTenant } from '../middleware/resolveTenant.js';
import { validate } from '../middleware/validate.js';
import {
  feedbackBodySchema,
  streamChatBodySchema,
  tenantSlugParamsSchema,
} from '../validators/chat.schemas.js';

const router = Router();

router.post(
  '/:slug/stream',
  chatLimiter,
  validate(tenantSlugParamsSchema, 'params'),
  validate(streamChatBodySchema, 'body'),
  resolveTenant,
  chatController.streamChat,
);

router.post(
  '/:slug/feedback',
  validate(tenantSlugParamsSchema, 'params'),
  validate(feedbackBodySchema, 'body'),
  resolveTenant,
  chatController.submitFeedback,
);

export default router;
