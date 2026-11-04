import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/utils/ApiError';

describe('ApiError', () => {
  it('creates typed errors with status codes', () => {
    const error = ApiError.notFound('Product');
    expect(error.statusCode).toBe(404);
    expect(error.message).toContain('Product');
  });

  it('supports validation and forbidden helpers', () => {
    expect(ApiError.validation('bad').statusCode).toBe(422);
    expect(ApiError.forbidden('nope').statusCode).toBe(403);
    expect(ApiError.unauthorized().statusCode).toBe(401);
  });
});