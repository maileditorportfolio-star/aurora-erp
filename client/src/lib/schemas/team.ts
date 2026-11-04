import { z } from 'zod';
import type { RoleKey } from '@/lib/types';

export const ASSIGNABLE_ROLES: RoleKey[] = ['org_admin', 'manager', 'employee', 'accountant'];

export interface TeamUser {
  id?: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
  status?: string;
  lastLoginAt?: string;
}

export interface TeamMember {
  id: string;
  user?: TeamUser | string;
  role: RoleKey;
  title?: string;
  status: 'active' | 'invited' | 'suspended';
  permissions?: { grants?: string[]; revokes?: string[] };
  effectivePermissions?: string[];
  createdAt?: string;
}

export interface InviteResult {
  email: string;
  temporaryPassword?: string;
  note: string;
}

export const inviteSchema = z.object({
  name: z.string().trim().min(2, 'Enter the person’s name').max(120),
  email: z.string().trim().email('Enter a valid email'),
  role: z.enum(['org_admin', 'manager', 'employee', 'accountant']),
  title: z.string().max(120).optional(),
  password: z
    .string()
    .optional()
    .refine(
      (value) =>
        !value ||
        (value.length >= 8 &&
          /[A-Z]/.test(value) &&
          /[a-z]/.test(value) &&
          /[0-9]/.test(value)),
      'Use 8+ characters with upper, lower and a number',
    ),
});

export const editSchema = z.object({
  role: z.enum(['org_admin', 'manager', 'employee', 'accountant']),
  title: z.string().max(120).optional(),
  status: z.enum(['active', 'suspended']),
});

export type InviteValues = z.infer<typeof inviteSchema>;
export type EditValues = z.infer<typeof editSchema>;

export const ROLE_VARIANTS: Record<string, 'default' | 'info' | 'success' | 'warning' | 'outline'> = {
  org_admin: 'default',
  manager: 'info',
  accountant: 'success',
  employee: 'outline',
  super_admin: 'warning',
};
