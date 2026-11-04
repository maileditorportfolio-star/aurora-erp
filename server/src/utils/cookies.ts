import type { Request, Response } from 'express';
import { env } from '../config/env';
import { refreshCookieMaxAge, refreshCookieName } from './jwt';

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(refreshCookieName(), token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.isProduction ? 'strict' : 'lax',
    path: '/',
    domain: env.COOKIE_DOMAIN || undefined,
    maxAge: refreshCookieMaxAge(),
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(refreshCookieName(), {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.isProduction ? 'strict' : 'lax',
    path: '/',
    domain: env.COOKIE_DOMAIN || undefined,
  });
}

export function refreshTokenFromRequest(req: Request): string | undefined {
  const cookieToken = (req.cookies as Record<string, string> | undefined)?.[refreshCookieName()];
  if (cookieToken) return cookieToken;
  const headerToken = req.headers['x-refresh-token'];
  if (typeof headerToken === 'string') return headerToken;
  const body = req.body as { refreshToken?: string } | undefined;
  return body?.refreshToken;
}

export function shouldReturnRefreshToken(req: Request): boolean {
  return req.headers['x-token-delivery'] === 'body';
}
