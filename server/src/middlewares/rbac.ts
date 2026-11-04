import type { NextFunction, Request, Response } from 'express';
import { hasPermission, type Permission } from '../config/permissions';
import { ApiError } from '../utils/ApiError';

export function requirePermission(...required: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.user?.isSuperAdmin) return next();
    const permissions = req.membership?.permissions;
    if (!permissions || !required.every((permission) => hasPermission(permissions, permission))) {
      return next(ApiError.forbidden());
    }
    next();
  };
}

export function requireAnyPermission(...required: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.user?.isSuperAdmin) return next();
    const permissions = req.membership?.permissions;
    if (!permissions || !required.some((permission) => hasPermission(permissions, permission))) {
      return next(ApiError.forbidden());
    }
    next();
  };
}

export function requireSuperAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user?.isSuperAdmin) return next(ApiError.forbidden('Platform administrator access required'));
  next();
}
