import type { Types } from 'mongoose';
import type { RoleKey } from '../config/permissions';
import type { OrganizationSettings } from '../models/core';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  isSuperAdmin: boolean;
  status: string;
  avatarUrl?: string;
}

export interface AuthMembership {
  id: string;
  organizationId: string;
  role: RoleKey;
  permissions: string[];
  status: string;
}

export interface AuthOrganization {
  id: string;
  name: string;
  slug: string;
  role: RoleKey;
  plan: string;
  logoUrl?: string;
  brandColor?: string;
  appName?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      membership?: AuthMembership;
      organizationId?: string;
      requestId?: string;
      tenantOrganization?: {
        _id: Types.ObjectId;
        name: string;
        slug: string;
        status: string;
        settings?: OrganizationSettings;
      };
    }
  }
}

export {};
