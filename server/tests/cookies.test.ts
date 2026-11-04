import { describe, expect, it } from 'vitest';
import { clearRefreshCookie, refreshTokenFromRequest, setRefreshCookie, shouldReturnRefreshToken } from '../src/utils/cookies';

describe('cookies', () => {
  it('sets and clears refresh cookies without throwing', () => {
    const res = {
      cookie: () => res,
      clearCookie: () => res,
    } as unknown as Parameters<typeof setRefreshCookie>[0];

    expect(() => setRefreshCookie(res, 'refresh-token')).not.toThrow();
    expect(() => clearRefreshCookie(res)).not.toThrow();
  });

  it('reads refresh token from cookie, header, or body', () => {
    const req = {
      cookies: { aurora_refresh: 'cookie-token' },
      headers: {},
      body: {},
    } as unknown as Parameters<typeof refreshTokenFromRequest>[0];
    expect(refreshTokenFromRequest(req)).toBe('cookie-token');

    const headerReq = {
      cookies: {},
      headers: { 'x-refresh-token': 'header-token' },
      body: {},
    } as unknown as Parameters<typeof refreshTokenFromRequest>[0];
    expect(refreshTokenFromRequest(headerReq)).toBe('header-token');

    const bodyReq = {
      cookies: {},
      headers: {},
      body: { refreshToken: 'body-token' },
    } as unknown as Parameters<typeof refreshTokenFromRequest>[0];
    expect(refreshTokenFromRequest(bodyReq)).toBe('body-token');
  });

  it('detects body token delivery', () => {
    const req = { headers: { 'x-token-delivery': 'body' } } as unknown as Parameters<typeof shouldReturnRefreshToken>[0];
    expect(shouldReturnRefreshToken(req)).toBe(true);
    const other = { headers: {} } as unknown as Parameters<typeof shouldReturnRefreshToken>[0];
    expect(shouldReturnRefreshToken(other)).toBe(false);
  });
});