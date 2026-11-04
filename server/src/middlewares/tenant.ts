import type { NextFunction, Request, Response } from 'express';
import { enterTenantContext } from '../plugins/tenant';
import { ApiError } from '../utils/ApiError';

export function tenantContext(req: Request, _res: Response, next: NextFunction): void {
  if (!req.organizationId) return next();
  enterTenantContext({
    organizationId: req.organizationId,
    userId: req.user?.id,
    isSuperAdmin: req.user?.isSuperAdmin,
  });
  next();
}

export function requireOrganization(req: Request, _res: Response, next: NextFunction): void {
  if (!req.organizationId) {
    return next(ApiError.forbidden('Select an organization to continue'));
  }
  next();
}

/**
 * Allows platform administrators to explicitly run cross-tenant operations.
 * The flag is scoped to the current request only.
 */
export function platformScope(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user?.isSuperAdmin) {
    return next(ApiError.forbidden('Platform administrator access required'));
  }
  enterTenantContext({ skipTenant: true, userId: req.user.id, isSuperAdmin: true });
  next();
}
