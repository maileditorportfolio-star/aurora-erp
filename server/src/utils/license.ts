import crypto from 'node:crypto';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { ApiError } from './ApiError';

export interface LicensePayload {
  licensee: string;
  edition: 'starter' | 'professional' | 'enterprise';
  issuedAt: string;
  expiresAt?: string;
  maxOrganizations?: number;
  maxUsers?: number;
  features?: string[];
  licenseId: string;
}

export interface LicenseStatus {
  valid: boolean;
  enforced: boolean;
  edition: LicensePayload['edition'] | 'unlicensed';
  licensee?: string;
  expiresAt?: string;
  maxOrganizations?: number;
  maxUsers?: number;
  features: string[];
  licenseId?: string;
  reason?: string;
}

let cached: LicenseStatus | null = null;

export function verifyLicenseKey(key: string, publicKeyBase64: string): LicenseStatus {
  const unlicensed = (reason: string): LicenseStatus => ({
    valid: false,
    enforced: Boolean(env.LICENSE_ENFORCEMENT),
    edition: 'unlicensed',
    features: [],
    reason,
  });

  if (!key) return unlicensed('No license key configured');
  if (!publicKeyBase64) return unlicensed('No license public key configured');

  const parts = key.split('.');
  if (parts.length !== 3 || parts[0] !== 'AURORA') {
    return unlicensed('Malformed license key');
  }

  try {
    const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8')) as LicensePayload;
    const signature = Buffer.from(parts[2]!, 'base64url');
    const publicKey = crypto.createPublicKey({
      key: Buffer.from(publicKeyBase64, 'base64'),
      format: 'der',
      type: 'spki',
    });
    const validSignature = crypto.verify(
      null,
      Buffer.from(parts[1]!, 'utf8'),
      publicKey,
      signature,
    );
    if (!validSignature) return unlicensed('License signature is invalid');
    if (payload.expiresAt && new Date(payload.expiresAt).getTime() < Date.now()) {
      return { ...unlicensed('License has expired'), expiresAt: payload.expiresAt, licensee: payload.licensee };
    }
    return {
      valid: true,
      enforced: Boolean(env.LICENSE_ENFORCEMENT),
      edition: payload.edition,
      licensee: payload.licensee,
      expiresAt: payload.expiresAt,
      maxOrganizations: payload.maxOrganizations,
      maxUsers: payload.maxUsers,
      features: payload.features ?? [],
      licenseId: payload.licenseId,
    };
  } catch (error) {
    logger.warn({ err: error }, 'License verification failed');
    return unlicensed('License could not be verified');
  }
}

export function getLicenseStatus(): LicenseStatus {
  if (!cached) {
    cached = verifyLicenseKey(env.licenseKey, env.licensePublicKey);
    if (!cached.valid && env.isProduction && env.LICENSE_ENFORCEMENT) {
      logger.error({ reason: cached.reason }, 'Commercial license is invalid');
    } else if (cached.valid) {
      logger.info(
        { licensee: cached.licensee, edition: cached.edition, expiresAt: cached.expiresAt },
        'Commercial license verified',
      );
    } else if (!env.isProduction) {
      logger.warn({ reason: cached.reason }, 'Running unlicensed in development mode');
    }
  }
  return cached;
}

export function assertLicenseAllowsBoot(): void {
  const status = getLicenseStatus();
  if (!status.valid && env.isProduction && env.LICENSE_ENFORCEMENT) {
    throw new Error(`Aurora ERP license invalid: ${status.reason}`);
  }
}

export function assertOrganizationAllowed(currentOrganizationCount: number): void {
  const status = getLicenseStatus();
  const limit = status.maxOrganizations || env.LICENSE_MAX_ORGANIZATIONS;
  if (status.enforced && !status.valid) {
    throw ApiError.forbidden('A valid commercial license is required to create organizations');
  }
  if (limit > 0 && currentOrganizationCount >= limit) {
    throw ApiError.forbidden(
      `Your license allows a maximum of ${limit} organizations. Contact sales to upgrade.`,
    );
  }
}

export function hasLicensedFeature(feature: string): boolean {
  const status = getLicenseStatus();
  if (!status.enforced || !status.valid) return true;
  return status.features.includes(feature) || status.features.includes('*');
}

export function resetLicenseCache(): void {
  cached = null;
}
