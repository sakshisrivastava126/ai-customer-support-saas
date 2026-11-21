import { z } from 'zod';

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const BOOLEAN_QUERY_VALUES = ['true', 'false'];

const paginationFields = {
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
};

export const conversationIdParamsSchema = z.object({
  id: z.string().regex(OBJECT_ID_PATTERN, 'must be a valid id'),
});

export const listConversationsQuerySchema = z.object({
  ...paginationFields,
  unansweredOnly: z
    .enum(BOOLEAN_QUERY_VALUES)
    .default('false')
    .transform((value) => value === 'true'),
});

export const listUnansweredQuerySchema = z.object(paginationFields);
