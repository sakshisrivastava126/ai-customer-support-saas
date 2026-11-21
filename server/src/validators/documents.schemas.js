import { z } from 'zod';

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DOCUMENT_STATUSES = ['processing', 'ready', 'failed'];

export const documentIdParamsSchema = z.object({
  id: z.string().regex(OBJECT_ID_PATTERN, 'must be a valid id'),
});

export const listDocumentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  status: z.enum(DOCUMENT_STATUSES).optional(),
});
