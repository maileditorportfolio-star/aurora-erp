import { z } from 'zod';
import { emailSchema, objectId, passwordSchema, phoneSchema } from './common';
import { ROLES } from '../config/permissions';

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  password: passwordSchema,
  organizationName: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(63)
    .regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers and hyphens only')
    .optional(),
  phone: phoneSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
  organizationSlug: z.string().trim().max(63).optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().optional(),
});

export const switchOrganizationSchema = z.object({
  organizationId: objectId,
});

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: phoneSchema,
  jobTitle: z.string().max(120).optional(),
  avatarUrl: z.string().max(500).optional(),
  timezone: z.string().max(60).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export const organizationUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  legalName: z.string().max(160).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(40).optional(),
  logoUrl: z.string().max(500).optional(),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  appName: z.string().max(80).optional(),
  plan: z.enum(['starter', 'professional', 'enterprise']).optional(),
  settings: z
    .object({
      currency: z.string().length(3).optional(),
      timezone: z.string().max(60).optional(),
      locale: z.string().max(20).optional(),
      dateFormat: z.string().max(30).optional(),
      taxRate: z.coerce.number().min(0).max(100).optional(),
      invoicePrefix: z.string().max(10).optional(),
      quotationPrefix: z.string().max(10).optional(),
      salesOrderPrefix: z.string().max(10).optional(),
      purchaseOrderPrefix: z.string().max(10).optional(),
      fiscalYearStart: z.coerce.number().int().min(1).max(12).optional(),
      invoiceDueDays: z.coerce.number().int().min(0).max(365).optional(),
      industry: z.string().max(80).optional(),
      website: z.string().max(200).optional(),
      address: z
        .object({
          street: z.string().max(200).optional(),
          city: z.string().max(100).optional(),
          state: z.string().max(100).optional(),
          country: z.string().max(100).optional(),
          postalCode: z.string().max(30).optional(),
        })
        .optional(),
    })
    .optional(),
});

export const inviteMemberSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  role: z.enum(ROLES.filter((role) => role !== 'super_admin') as [string, ...string[]]),
  title: z.string().max(120).optional(),
  password: passwordSchema.optional(),
});

export const updateMemberSchema = z.object({
  role: z.enum(ROLES.filter((role) => role !== 'super_admin') as [string, ...string[]]).optional(),
  title: z.string().max(120).optional(),
  status: z.enum(['active', 'suspended']).optional(),
  permissions: z
    .object({
      grants: z.array(z.string().max(80)).max(100).optional(),
      revokes: z.array(z.string().max(80)).max(100).optional(),
    })
    .optional(),
});

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(63)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  ownerEmail: emailSchema,
  plan: z.enum(['starter', 'professional', 'enterprise']).optional(),
  status: z.enum(['active', 'trial', 'suspended']).optional(),
});

export const adminOrganizationUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  plan: z.enum(['starter', 'professional', 'enterprise']).optional(),
  status: z.enum(['active', 'trial', 'suspended', 'cancelled']).optional(),
  appName: z.string().max(80).optional(),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});
