import { z } from 'zod';

export const idSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid identifier');

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().max(120).optional(),
  sort: z.string().max(120).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  withDeleted: z.coerce.boolean().optional(),
});

export const addressSchema = z
  .object({
    street: z.string().max(200).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(100).optional(),
    country: z.string().max(100).optional(),
    postalCode: z.string().max(30).optional(),
  })
  .optional();

export const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid identifier');

export const optionalObjectId = z
  .union([objectId, z.literal(''), z.null()])
  .optional()
  .transform((value) => (value === '' || value === null ? undefined : value));

export const lineItemSchema = z.object({
  product: optionalObjectId,
  description: z.string().trim().min(1).max(500),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().min(0).default(0),
  unitCost: z.coerce.number().min(0).default(0),
  discountRate: z.coerce.number().min(0).max(100).default(0),
  taxRate: z.coerce.number().min(0).max(100).default(0),
});

export const dateSchema = z.union([z.string(), z.date()]).transform((value) => new Date(value));

export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM format');

export const phoneSchema = z.string().trim().max(40).optional();
export const emailSchema = z.string().trim().email().max(200);

export function validatePassword(password: string): string[] {
  const issues: string[] = [];
  if (password.length < 8) issues.push('at least 8 characters');
  if (!/[A-Z]/.test(password)) issues.push('an uppercase letter');
  if (!/[a-z]/.test(password)) issues.push('a lowercase letter');
  if (!/[0-9]/.test(password)) issues.push('a number');
  return issues;
}

export const passwordSchema = z.string().min(8).superRefine((value, ctx) => {
  const issues = validatePassword(value);
  if (issues.length) {
    ctx.addIssue({
      code: 'custom',
      message: `Password needs ${issues.join(', ')}`,
    });
  }
});
