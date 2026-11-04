import dotenv from 'dotenv';
import path from 'node:path';
import { z } from 'zod';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });

const booleanish = z
  .string()
  .optional()
  .transform((value) => value === 'true' || value === '1');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  APP_NAME: z.string().default('Aurora ERP'),
  APP_VERSION: z.string().default('1.0.0'),
  API_PREFIX: z.string().default('/api/v1'),
  CLIENT_URL: z.string().default('http://localhost:3000'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/aurora_erp'),
  MONGODB_DB: z.string().default('aurora_erp'),

  JWT_ACCESS_SECRET: z.string().optional(),
  JWT_REFRESH_SECRET: z.string().optional(),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(8).max(15).default(12),
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: booleanish,
  AUTH_RATE_LIMIT: z.coerce.number().int().positive().default(20),

  TENANCY_BASE_DOMAIN: z.string().default('localhost'),
  ALLOW_SUBDOMAIN_TENANCY: booleanish,

  LOG_LEVEL: z.string().default('info'),
  LOG_PRETTY: z.string().optional(),
  TRUST_PROXY: z.coerce.number().int().default(1),

  LICENSE_KEY: z.string().optional(),
  LICENSE_PUBLIC_KEY: z.string().optional(),
  LICENSE_ENFORCEMENT: booleanish,
  LICENSE_MAX_ORGANIZATIONS: z.coerce.number().int().min(0).default(0),

  DEFAULT_CURRENCY: z.string().default('USD'),
  DEFAULT_TAX_RATE: z.coerce.number().min(0).default(0),
  INVOICE_DUE_DAYS: z.coerce.number().int().positive().default(30),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', z.treeifyError(parsed.error));
  throw new Error('Invalid environment configuration');
}

const raw = parsed.data;
const isProduction = raw.NODE_ENV === 'production';
const isTest = raw.NODE_ENV === 'test';

const accessSecret =
  raw.JWT_ACCESS_SECRET ?? (isProduction ? '' : 'aurora-development-access-secret-change-me-32');
const refreshSecret =
  raw.JWT_REFRESH_SECRET ??
  (isProduction ? '' : 'aurora-development-refresh-secret-change-me-32');

if ((!accessSecret || !refreshSecret) && !isTest) {
  throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are required');
}
if (isProduction) {
  if (accessSecret.length < 32 || refreshSecret.length < 32) {
    throw new Error('JWT secrets must be at least 32 characters in production');
  }
  if (accessSecret === refreshSecret) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different');
  }
}

export const env = {
  ...raw,
  isProduction,
  isTest,
  isDevelopment: raw.NODE_ENV === 'development',
  JWT_ACCESS_SECRET: accessSecret,
  JWT_REFRESH_SECRET: refreshSecret,
  LOG_PRETTY: raw.LOG_PRETTY === undefined ? !isProduction : raw.LOG_PRETTY === 'true',
  COOKIE_SECURE: raw.COOKIE_SECURE || isProduction,
  corsOrigins: raw.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  licensePublicKey: raw.LICENSE_PUBLIC_KEY?.trim() ?? '',
  licenseKey: raw.LICENSE_KEY?.trim() ?? '',
};

export type Env = typeof env;
