import { Router } from 'express';
import * as publicController from '../controllers/public.controller.js';
import { validate } from '../middleware/validate.js';
import { tenantSlugParamsSchema } from '../validators/chat.schemas.js';

const router = Router();

router.get('/tenants/:slug', validate(tenantSlugParamsSchema, 'params'), publicController.getTenantConfig);

export default router;
