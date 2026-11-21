import { Router } from 'express';
import * as conversationsController from '../controllers/conversations.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { validate } from '../middleware/validate.js';
import {
  conversationIdParamsSchema,
  listConversationsQuerySchema,
  listUnansweredQuerySchema,
} from '../validators/conversations.schemas.js';

const router = Router();

router.use(requireAuth, requireRole('admin', 'user'));

router.get('/', validate(listConversationsQuerySchema, 'query'), conversationsController.listConversations);
router.get(
  '/unanswered',
  validate(listUnansweredQuerySchema, 'query'),
  conversationsController.listUnansweredQuestions,
);
router.get('/:id', validate(conversationIdParamsSchema, 'params'), conversationsController.getConversation);

export default router;
