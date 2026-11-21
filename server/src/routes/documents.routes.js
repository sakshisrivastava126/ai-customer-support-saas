import { Router } from 'express';
import * as documentsController from '../controllers/documents.controller.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { uploadLimiter } from '../middleware/rateLimiters.js';
import { uploadSingleFile } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { documentIdParamsSchema, listDocumentsQuerySchema } from '../validators/documents.schemas.js';

const router = Router();

router.use(requireAuth, requireRole('admin'));

router.get('/', validate(listDocumentsQuerySchema, 'query'), documentsController.listDocuments);
router.post('/', uploadLimiter, uploadSingleFile, documentsController.uploadDocument);
router.get('/:id', validate(documentIdParamsSchema, 'params'), documentsController.getDocument);
router.delete('/:id', validate(documentIdParamsSchema, 'params'), documentsController.deleteDocument);

export default router;
