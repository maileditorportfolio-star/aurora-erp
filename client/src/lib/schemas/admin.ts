import { z } from 'zod';

export const createOrgSchema = z.object({
  name: z.string().trim().min(2, 'Enter a workspace name').max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(63)
    .regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers and hyphens only')
    .optional()
    .or(z.literal('')),
  ownerEmail: z.string().trim().email('Enter a valid owner email'),
  plan: z.enum(['starter', 'professional', 'enterprise']),
  status: z.enum(['active', 'trial', 'suspended']),
});

export type CreateOrgValues = z.infer<typeof createOrgSchema>;

export const editOrgSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  plan: z.enum(['starter', 'professional', 'enterprise']).optional(),
  status: z.enum(['active', 'trial', 'suspended', 'cancelled']).optional(),
  appName: z.string().max(80).optional(),
  brandColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .or(z.literal('')),
});

export type EditOrgValues = z.infer<typeof editOrgSchema>;