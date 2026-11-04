import { z } from 'zod';

/** Convert blank inputs to `undefined` before validating optional numbers. */
export const optionalNumber = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? undefined : value),
  z.coerce.number().optional(),
);

/** Convert blank inputs to `0` for numeric fields that always send a value. */
export const numberField = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? 0 : value),
  z.coerce.number(),
);

export const optionalString = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  z.string().optional(),
);

export const optionalId = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  z.string().optional(),
);

export const optionalEmail = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  z.string().email('Enter a valid email address').optional(),
);

export const optionalDate = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  z.string().optional(),
);

export function firstError(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const issues = (error as { issues?: Array<{ message?: string }> }).issues;
  return issues?.[0]?.message;
}
