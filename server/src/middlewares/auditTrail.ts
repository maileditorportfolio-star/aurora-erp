import type { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import { AuditLog } from '../models/core';
import { logger } from '../config/logger';
import { getTenantContext, runWithTenant } from '../plugins/tenant';

const SENSITIVE_KEYS = new Set([
  'password',
  'currentPassword',
  'newPassword',
  'refreshToken',
  'token',
  'authorization',
]);

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitize(item, depth + 1));
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !SENSITIVE_KEYS.has(key))
        .map(([key, item]) => [key, sanitize(item, depth + 1)]),
    );
  }
  return value;
}

function resourceFromPath(path: string): { resource: string; resourceId?: string } {
  const parts = path.split('?')[0]!.split('/').filter(Boolean);
  const apiIndex = parts.findIndex((part) => part === 'api');
  const relevant = parts.slice(apiIndex + 2);
  if (relevant[0] === 'v1') relevant.shift();
  const resource = relevant[0] ?? 'unknown';
  const resourceId = /^[0-9a-fA-F]{24}$/.test(relevant[1] ?? '') ? relevant[1] : undefined;
  return { resource, resourceId };
}

export function auditTrail(req: Request, res: Response, next: NextFunction): void {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  const context = getTenantContext();

  res.on('finish', () => {
    if (!req.user) return;
    const { resource, resourceId } = resourceFromPath(req.originalUrl);
    const action = req.method === 'POST' ? 'create' : req.method === 'DELETE' ? 'delete' : 'update';
    const payload = {
      organization: req.organizationId ? new Types.ObjectId(req.organizationId) : undefined,
      actor: req.user.id ? new Types.ObjectId(req.user.id) : undefined,
      actorName: req.user.name,
      action,
      resource,
      resourceId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      changes: res.statusCode < 400 ? sanitize(req.body) : undefined,
    };
    const write = () =>
      AuditLog.create(payload).catch((error) =>
        logger.warn({ err: error }, 'Failed to write audit log'),
      );
    if (context) runWithTenant(context, write);
    else void write();
  });

  next();
}
