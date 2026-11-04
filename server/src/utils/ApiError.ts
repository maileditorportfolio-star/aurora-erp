export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;
  readonly isOperational: boolean;

  constructor(statusCode: number, message: string, details?: unknown, code = 'ERROR') {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad request', details?: unknown): ApiError {
    return new ApiError(400, message, details, 'BAD_REQUEST');
  }

  static unauthorized(message = 'Authentication required'): ApiError {
    return new ApiError(401, message, undefined, 'UNAUTHORIZED');
  }

  static forbidden(message = 'You do not have permission to perform this action'): ApiError {
    return new ApiError(403, message, undefined, 'FORBIDDEN');
  }

  static notFound(resource = 'Resource'): ApiError {
    return new ApiError(404, `${resource} not found`, undefined, 'NOT_FOUND');
  }

  static conflict(message = 'Resource already exists', details?: unknown): ApiError {
    return new ApiError(409, message, details, 'CONFLICT');
  }

  static validation(message = 'Validation failed', details?: unknown): ApiError {
    return new ApiError(422, message, details, 'VALIDATION_ERROR');
  }

  static tooMany(message = 'Too many requests'): ApiError {
    return new ApiError(429, message, undefined, 'RATE_LIMITED');
  }

  static internal(message = 'Internal server error'): ApiError {
    return new ApiError(500, message, undefined, 'INTERNAL_ERROR');
  }
}
