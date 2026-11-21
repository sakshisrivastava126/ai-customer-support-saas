import * as tenantService from '../services/tenant.service.js';

export async function getTenantConfig(req, res) {
  const tenant = await tenantService.getTenantBySlug(req.params.slug);
  res.json(tenantService.toPublicTenantConfig(tenant));
}
