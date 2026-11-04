import { describe, expect, it } from 'vitest';
import { createRefreshToken, hashToken, signAccessToken, verifyAccessToken } from '../src/utils/jwt';

describe('jwt', () => {
  it('signs and verifies access tokens', () => {
    const token = signAccessToken({
      sub: 'user-1',
      role: 'employee',
      isSuperAdmin: false,
      permissions: ['dashboard:read'],
    });

    const verified = verifyAccessToken(token);
    expect(verified.sub).toBe('user-1');
    expect(verified.role).toBe('employee');
  });

  it('creates hashed refresh tokens', () => {
    const { token, hash } = createRefreshToken();
    expect(token.length).toBeGreaterThan(20);
    expect(hash).toBe(hashToken(token));
  });
});