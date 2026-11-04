import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import { env } from '../config/env';

function limitHandler(_req: Request, res: Response) {
  res.status(429).json({
    success: false,
    error: 'Too many requests. Please try again later.',
    code: 'RATE_LIMITED',
  });
}

const base = {
  standardHeaders: 'draft-7' as const,
  legacyHeaders: false,
  handler: limitHandler,
  skip: () => env.isTest,
};

export const generalLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 600,
});

export const authLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: env.AUTH_RATE_LIMIT,
});

export const writeLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  limit: 120,
});
