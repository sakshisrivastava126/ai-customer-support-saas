import { getTenantBySlug } from '../services/tenant.service.js';

export async function resolveTenant(req, res, next) {
  req.tenant = await getTenantBySlug(req.params.slug);
  next();
}
