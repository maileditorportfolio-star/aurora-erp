import type { Response } from 'express';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  details?: unknown;
  meta?: PaginationMeta | Record<string, unknown>;
  requestId?: string;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  status = 200,
  meta?: PaginationMeta | Record<string, unknown>,
): Response {
  const body: ApiEnvelope<T> = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}

export function sendCreated<T>(res: Response, data: T): Response {
  return sendSuccess(res, data, 201);
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  meta: PaginationMeta,
  extra?: Record<string, unknown>,
): Response {
  return sendSuccess(res, data, 200, { ...meta, ...extra });
}

export function sendNoContent(res: Response): Response {
  return res.status(204).send();
}
