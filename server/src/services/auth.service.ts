import crypto from 'node:crypto';
import { Types } from 'mongoose';
import { env } from '../config/env';
import { effectivePermissions, type RoleKey, ROLES } from '../config/permissions';
import { Membership, Organization, RefreshToken, User } from '../models';
import { ApiError } from '../utils/ApiError';
import { hashPassword, verifyPassword } from '../utils/password';
import { bootstrapOrganization } from './organization.service';
import {
  createRefreshToken,
  hashToken,
  refreshTokenExpiry,
  signAccessToken,
} from '../utils/jwt';
import { assertOrganizationAllowed } from '../utils/license';
import { serializeOrganization } from './organization.service';

export interface SessionRequestMeta {
  ip?: string;
  userAgent?: string;
}

export interface SessionResult {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    isSuperAdmin: boolean;
    avatarUrl?: string;
    phone?: string;
    jobTitle?: string;
  };
  activeOrganization: ReturnType<typeof serializeOrganization> | null;
  membership: {
    id: string;
    role: RoleKey;
    permissions: string[];
    title?: string;
  } | null;
  organizations: (ReturnType<typeof serializeOrganization> & { role: RoleKey })[];
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

async function uniqueSlug(base: string): Promise<string> {
  let candidate = slugify(base);
  if (candidate.length < 2) candidate = `org-${crypto.randomBytes(3).toString('hex')}`;
  let suffix = 0;
  while (await Organization.exists({ slug: candidate })) {
    suffix += 1;
    candidate = `${slugify(base).slice(0, 52)}-${suffix}`;
    if (suffix > 50) throw ApiError.conflict('Could not allocate a unique workspace slug');
  }
  return candidate;
}

export async function listUserOrganizations(userId: Types.ObjectId | string, isSuperAdmin: boolean) {
  if (isSuperAdmin) {
    const organizations = await Organization.find({ status: { $ne: 'cancelled' } })
      .sort({ name: 1 })
      .lean();
    return organizations.map((organization) => ({
      ...serializeOrganization(organization),
      role: 'super_admin' as RoleKey,
    }));
  }

  const memberships = await Membership.find({ user: userId, status: 'active' })
    .populate('organization')
    .lean();
  return memberships
    .filter((membership) => membership.organization)
    .map((membership) => ({
      ...serializeOrganization(
        membership.organization as unknown as Parameters<typeof serializeOrganization>[0],
      ),
      role: membership.role,
    }));
}

async function buildSession(
  user: Awaited<ReturnType<typeof User.findOne>> & { _id: Types.ObjectId },
  organizationId: string | null,
  membershipId: string | null,
  meta: SessionRequestMeta,
  family?: string,
): Promise<SessionResult> {
  const isSuperAdmin = Boolean(user.isSuperAdmin);
  let activeOrganization = null as ReturnType<typeof serializeOrganization> | null;
  let membership = null as SessionResult['membership'];
  let permissions: string[] = [];

  if (organizationId) {
    const organization = await Organization.findById(organizationId).lean();
    if (!organization) throw ApiError.notFound('Organization');
    if (['suspended', 'cancelled'].includes(organization.status) && !isSuperAdmin) {
      throw ApiError.forbidden('This organization is suspended');
    }
    activeOrganization = serializeOrganization(organization);

    if (membershipId) {
      const record = await Membership.findOne({
        _id: membershipId,
        user: user._id,
        organization: organization._id,
        status: 'active',
      }).lean();
      if (!record) throw ApiError.forbidden('Membership is not active');
      membership = {
        id: String(record._id),
        role: record.role,
        permissions: effectivePermissions(
          record.role,
          record.permissions?.grants,
          record.permissions?.revokes,
        ),
        title: record.title,
      };
      permissions = membership.permissions;
    } else if (isSuperAdmin) {
      membership = {
        id: 'super',
        role: 'super_admin',
        permissions: ['*'],
      };
      permissions = ['*'];
    }
  }

  const accessToken = signAccessToken({
    sub: String(user._id),
    orgId: organizationId ?? undefined,
    membershipId: membershipId ?? undefined,
    role: membership?.role ?? (isSuperAdmin ? 'super_admin' : 'employee'),
    isSuperAdmin,
    permissions,
  });

  const refresh = createRefreshToken();
  const expiresAt = refreshTokenExpiry();
  await RefreshToken.create({
    user: user._id,
    organization: organizationId ? new Types.ObjectId(organizationId) : undefined,
    membership: membershipId ? new Types.ObjectId(membershipId) : undefined,
    tokenHash: refresh.hash,
    family: family ?? crypto.randomUUID(),
    expiresAt,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  const organizations = await listUserOrganizations(user._id, isSuperAdmin);

  return {
    accessToken,
    refreshToken: refresh.token,
    refreshTokenExpiresAt: expiresAt,
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      isSuperAdmin,
      avatarUrl: user.avatarUrl,
      phone: user.phone,
      jobTitle: user.jobTitle,
    },
    activeOrganization,
    membership,
    organizations,
  };
}

export async function registerOrganization(input: {
  name: string;
  email: string;
  password: string;
  organizationName: string;
  slug?: string;
  phone?: string;
  meta: SessionRequestMeta;
}): Promise<SessionResult> {
  const email = input.email.toLowerCase().trim();
  const existingUser = await User.findOne({ email }).lean();
  if (existingUser) throw ApiError.conflict('An account with this email already exists');

  const organizationCount = await Organization.countDocuments();
  assertOrganizationAllowed(organizationCount);

  const slug = input.slug ? slugify(input.slug) : await uniqueSlug(input.organizationName);
  if (await Organization.exists({ slug })) throw ApiError.conflict('Workspace slug is already taken');

  const user = await User.create({
    name: input.name,
    email,
    passwordHash: await hashPassword(input.password),
    phone: input.phone,
    status: 'active',
    isSuperAdmin: false,
  });

  const organization = await Organization.create({
    name: input.organizationName,
    slug,
    email,
    owner: user._id,
    status: 'trial',
    trialEndsAt: new Date(Date.now() + 14 * 86_400_000),
    settings: { currency: env.DEFAULT_CURRENCY, invoiceDueDays: env.INVOICE_DUE_DAYS },
  });

  const membership = await Membership.create({
    organization: organization._id,
    user: user._id,
    role: 'org_admin',
    status: 'active',
    title: 'Owner',
    joinedAt: new Date(),
  });

  await bootstrapOrganization(organization._id);

  user.lastLoginAt = new Date();
  await user.save();
  return buildSession(user, String(organization._id), String(membership._id), input.meta);
}

export async function login(input: {
  email: string;
  password: string;
  organizationSlug?: string;
  meta: SessionRequestMeta;
}): Promise<SessionResult> {
  const user = await User.findOne({ email: input.email.toLowerCase().trim() }).select('+passwordHash');
  if (!user) throw ApiError.unauthorized('Invalid email or password');
  if (user.status === 'suspended') throw ApiError.forbidden('Your account is suspended');

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) throw ApiError.unauthorized('Invalid email or password');

  let organizationId: string | null = null;
  let membershipId: string | null = null;

  if (input.organizationSlug) {
    const organization = await Organization.findOne({ slug: input.organizationSlug.toLowerCase() }).lean();
    if (!organization) throw ApiError.unauthorized('Workspace not found');
    organizationId = String(organization._id);
    if (!user.isSuperAdmin) {
      const membership = await Membership.findOne({
        user: user._id,
        organization: organization._id,
        status: 'active',
      }).lean();
      if (!membership) throw ApiError.forbidden('You do not have access to this workspace');
      membershipId = String(membership._id);
    }
  } else if (user.isSuperAdmin) {
    const organization = await Organization.findOne({ status: { $ne: 'cancelled' } }).sort({ createdAt: 1 }).lean();
    organizationId = organization ? String(organization._id) : null;
  } else {
    const membership = await Membership.findOne({ user: user._id, status: 'active' })
      .sort({ createdAt: 1 })
      .populate('organization')
      .lean();
    if (!membership) throw ApiError.forbidden('No active workspace is assigned to your account');
    const organization = membership.organization as unknown as { _id: Types.ObjectId; status: string };
    if (!organization || ['suspended', 'cancelled'].includes(organization.status)) {
      throw ApiError.forbidden('This workspace is suspended');
    }
    organizationId = String(organization._id);
    membershipId = String(membership._id);
  }

  user.lastLoginAt = new Date();
  await user.save();
  return buildSession(user, organizationId, membershipId, input.meta);
}

export async function refreshSession(
  rawToken: string,
  meta: SessionRequestMeta,
): Promise<SessionResult> {
  if (!rawToken) throw ApiError.unauthorized('Refresh token is missing');
  const tokenHash = hashToken(rawToken);
  const record = await RefreshToken.findOne({ tokenHash });

  if (!record) throw ApiError.unauthorized('Refresh token is invalid');
  if (record.revokedAt) {
    await RefreshToken.updateMany(
      { family: record.family, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
    throw ApiError.unauthorized('Refresh token has been revoked');
  }
  if (record.expiresAt.getTime() < Date.now()) {
    throw ApiError.unauthorized('Refresh token has expired');
  }

  const user = await User.findById(record.user).select('+passwordHash');
  if (!user || user.status !== 'active') throw ApiError.unauthorized('Account is not active');

  const result = await buildSession(
    user,
    record.organization ? String(record.organization) : null,
    record.membership ? String(record.membership) : null,
    meta,
    record.family,
  );

  record.revokedAt = new Date();
  record.replacedByHash = hashToken(result.refreshToken);
  await record.save();
  return result;
}

export async function revokeRefreshToken(rawToken: string | undefined): Promise<void> {
  if (!rawToken) return;
  await RefreshToken.updateOne(
    { tokenHash: hashToken(rawToken), revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  await RefreshToken.updateMany(
    { user: new Types.ObjectId(userId), revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
}

export async function switchOrganization(
  userId: string,
  isSuperAdmin: boolean,
  organizationId: string,
  currentRefreshToken: string | undefined,
  meta: SessionRequestMeta,
): Promise<SessionResult> {
  if (!ROLES.includes('org_admin')) throw ApiError.internal('Role configuration error');
  if (!Types.ObjectId.isValid(organizationId)) throw ApiError.validation('Invalid organization');

  const organization = await Organization.findById(organizationId).lean();
  if (!organization) throw ApiError.notFound('Organization');
  if (['suspended', 'cancelled'].includes(organization.status) && !isSuperAdmin) {
    throw ApiError.forbidden('This organization is suspended');
  }

  let membershipId: string | null = null;
  if (!isSuperAdmin) {
    const membership = await Membership.findOne({
      user: new Types.ObjectId(userId),
      organization: organization._id,
      status: 'active',
    }).lean();
    if (!membership) throw ApiError.forbidden('You do not have access to this workspace');
    membershipId = String(membership._id);
  }

  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw ApiError.unauthorized();
  await revokeRefreshToken(currentRefreshToken);
  return buildSession(user, String(organization._id), membershipId, meta);
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw ApiError.notFound('User');
  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) throw ApiError.validation('Current password is incorrect');
  user.passwordHash = await hashPassword(newPassword);
  user.passwordChangedAt = new Date();
  await user.save();
  await revokeAllUserSessions(userId);
}
