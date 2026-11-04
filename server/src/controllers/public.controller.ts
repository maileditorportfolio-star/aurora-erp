import type { Request } from 'express';
import { Organization } from '../models';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { ApiError } from '../utils/ApiError';
import { env } from '../config/env';

function resolveSlug(req: Request): string | undefined {
  const querySlug = typeof req.query.slug === 'string' ? req.query.slug : undefined;
  if (querySlug) return querySlug.toLowerCase();
  const host = req.headers.host?.split(':')[0];
  if (!host || !env.ALLOW_SUBDOMAIN_TENANCY) return undefined;
  if (!host.endsWith(env.TENANCY_BASE_DOMAIN)) return undefined;
  const subdomain = host.slice(0, -(env.TENANCY_BASE_DOMAIN.length + 1));
  if (!subdomain || ['www', 'app', 'api'].includes(subdomain)) return undefined;
  return subdomain;
}

export const branding = asyncHandler(async (req, res) => {
  const slug = resolveSlug(req);
  if (!slug) {
    return sendSuccess(res, {
      name: env.APP_NAME,
      appName: env.APP_NAME,
      slug: null,
      logoUrl: null,
      brandColor: '#4f46e5',
      isWhiteLabel: true,
    });
  }
  const organization = await Organization.findOne({ slug, status: { $ne: 'cancelled' } })
    .select('name slug logoUrl brandColor appName status')
    .lean();
  if (!organization) throw ApiError.notFound('Workspace');
  return sendSuccess(res, {
    name: organization.name,
    appName: organization.appName ?? organization.name,
    slug: organization.slug,
    logoUrl: organization.logoUrl,
    brandColor: organization.brandColor,
    status: organization.status,
  });
});

export const health = asyncHandler(async (_req, res) => {
  return sendSuccess(res, {
    status: 'ok',
    app: env.APP_NAME,
    version: env.APP_VERSION,
    timestamp: new Date().toISOString(),
  });
});
