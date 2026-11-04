import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { ApiError } from '../utils/ApiError';

export function notFound(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.originalUrl} not found`,
    code: 'NOT_FOUND',
    requestId: req.requestId,
  });
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  let statusCode = 500;
  let message = 'Internal server error';
  let code = 'INTERNAL_ERROR';
  let details: unknown;

  if (error instanceof ApiError) {
    statusCode = error.statusCode;
    message = error.message;
    code = error.code;
    details = error.details;
  } else if (error instanceof ZodError) {
    statusCode = 422;
    message = 'Validation failed';
    code = 'VALIDATION_ERROR';
    details = error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
  } else if (error instanceof mongoose.Error.ValidationError) {
    statusCode = 422;
    message = 'Database validation failed';
    code = 'VALIDATION_ERROR';
    details = Object.values(error.errors).map((item) => ({
      field: item.path,
      message: item.message,
    }));
  } else if (error instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = `Invalid value for ${error.path}`;
    code = 'BAD_REQUEST';
  } else if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === 11000
  ) {
    statusCode = 409;
    message = 'A record with these details already exists';
    code = 'DUPLICATE_KEY';
    details = (error as { keyValue?: unknown }).keyValue;
  } else if (error instanceof SyntaxError && 'body' in error) {
    statusCode = 400;
    message = 'Malformed JSON request body';
    code = 'BAD_REQUEST';
  }

  if (statusCode >= 500) {
    logger.error(
      {
        err: error,
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        userId: req.user?.id,
        organizationId: req.organizationId,
      },
      'Unhandled request error',
    );
    if (env.isProduction) message = 'Internal server error';
  } else {
    logger.warn(
      {
        err: error instanceof Error ? error.message : error,
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        statusCode,
      },
      'Request rejected',
    );
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    code,
    ...(details ? { details } : {}),
    ...(req.requestId ? { requestId: req.requestId } : {}),
  });
}
