import { Tenant } from '../models/Tenant.js';
import { AppError } from '../utils/AppError.js';

export async function getTenantBySlug(slug) {
  const tenant = await Tenant.findOne({ slug }).select('_id name slug settings').lean();
  if (!tenant) throw new AppError(404, 'TENANT_NOT_FOUND', 'Tenant not found');
  return tenant;
}

export function toPublicTenantConfig(tenant) {
  return {
    name: tenant.name,
    botName: tenant.settings.botName,
    welcomeMessage: tenant.settings.welcomeMessage,
  };
}
