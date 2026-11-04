import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodType } from 'zod';
import { ApiError } from '../utils/ApiError';

type Source = 'body' | 'query' | 'params';

function formatZodError(error: ZodError) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message,
    code: issue.code,
  }));
}

export function validate(schema: ZodType, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(ApiError.validation('Validation failed', formatZodError(result.error)));
    }
    if (source === 'body') req.body = result.data;
    if (source === 'query') Object.assign(req.query, result.data);
    if (source === 'params') Object.assign(req.params, result.data);
    next();
  };
}

export const validateBody = (schema: ZodType) => validate(schema, 'body');
export const validateQuery = (schema: ZodType) => validate(schema, 'query');
export const validateParams = (schema: ZodType) => validate(schema, 'params');
