import { z } from 'zod';
import { config } from '../config/env.js';

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
const TENANT_SLUG_PATTERN = /^[a-z0-9-]{3,40}$/;
const FEEDBACK_RATINGS = ['up', 'down'];

const objectIdField = z.string().regex(OBJECT_ID_PATTERN, 'must be a valid id');
const visitorIdField = z.string().trim().toLowerCase().pipe(z.uuidv4());

export const tenantSlugParamsSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(TENANT_SLUG_PATTERN, 'must be a valid slug'),
});

export const streamChatBodySchema = z.object({
  message: z.string().trim().min(1).max(config.maxMessageChars),
  conversationId: objectIdField.optional(),
  visitorId: visitorIdField,
});

export const feedbackBodySchema = z.object({
  messageId: objectIdField,
  visitorId: visitorIdField,
  rating: z.enum(FEEDBACK_RATINGS),
});
