import crypto from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import type { RoleKey } from '../config/permissions';

export interface AccessTokenPayload {
  sub: string;
  orgId?: string;
  membershipId?: string;
  role: RoleKey;
  isSuperAdmin: boolean;
  permissions: string[];
  sessionId?: string;
}

export interface VerifiedAccessToken extends AccessTokenPayload {
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

const ISSUER = 'aurora-erp';
const AUDIENCE = 'aurora-erp-api';

export function signAccessToken(payload: AccessTokenPayload): string {
  const options: SignOptions = {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'],
    issuer: ISSUER,
    audience: AUDIENCE,
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
}

export function verifyAccessToken(token: string): VerifiedAccessToken {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, {
    issuer: ISSUER,
    audience: AUDIENCE,
  }) as VerifiedAccessToken;
}

export function createRefreshToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(48).toString('base64url');
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function refreshTokenExpiry(): Date {
  const match = /^(\d+)([smhd])$/.exec(env.JWT_REFRESH_EXPIRES_IN);
  if (!match) return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const value = Number(match[1]);
  const unit = match[2]!;
  const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return new Date(Date.now() + value * (multipliers[unit] ?? 86_400_000));
}

export function refreshCookieMaxAge(): number {
  const match = /^(\d+)([smhd])$/.exec(env.JWT_REFRESH_EXPIRES_IN);
  if (!match) return 30 * 24 * 60 * 60 * 1000;
  const value = Number(match[1]);
  const unit = match[2]!;
  const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return value * (multipliers[unit] ?? 86_400_000);
}

export function refreshCookieName(): string {
  return env.isProduction ? '__Host-aurora_refresh' : 'aurora_refresh';
}
