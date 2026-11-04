import type { Request, Response } from 'express';
import { env } from '../config/env';
import { effectivePermissions, ROLE_LABELS, ROLES } from '../config/permissions';
import { Membership, Organization, User } from '../models';
import {
  changePassword,
  listUserOrganizations,
  login,
  refreshSession,
  registerOrganization,
  revokeAllUserSessions,
  revokeRefreshToken,
  switchOrganization,
  type SessionResult,
} from '../services/auth.service';
import { serializeOrganization } from '../services/organization.service';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import {
  clearRefreshCookie,
  refreshTokenFromRequest,
  setRefreshCookie,
  shouldReturnRefreshToken,
} from '../utils/cookies';
import { sendCreated, sendSuccess } from '../utils/response';

function requestMeta(req: Request) {
  return { ip: req.ip, userAgent: req.headers['user-agent'] };
}

function respondSession(req: Request, res: Response, session: SessionResult, status = 200) {
  setRefreshCookie(res, session.refreshToken);
  const { refreshToken, ...rest } = session;
  return sendSuccess(
    res,
    shouldReturnRefreshToken(req) ? { ...rest, refreshToken } : rest,
    status,
  );
}

export const register = asyncHandler(async (req, res) => {
  const session = await registerOrganization({ ...req.body, meta: requestMeta(req) });
  return respondSession(req, res, session, 201);
});

export const loginHandler = asyncHandler(async (req, res) => {
  const session = await login({ ...req.body, meta: requestMeta(req) });
  return respondSession(req, res, session);
});

export const refresh = asyncHandler(async (req, res) => {
  const token = refreshTokenFromRequest(req);
  if (!token) {
    clearRefreshCookie(res);
    throw ApiError.unauthorized('Refresh token is missing');
  }
  try {
    const session = await refreshSession(token, requestMeta(req));
    return respondSession(req, res, session);
  } catch (error) {
    clearRefreshCookie(res);
    throw error;
  }
});

export const logout = asyncHandler(async (req, res) => {
  const token = refreshTokenFromRequest(req);
  await revokeRefreshToken(token);
  clearRefreshCookie(res);
  return sendSuccess(res, { loggedOut: true });
});

export const me = asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const user = await User.findById(req.user.id).lean();
  if (!user) throw ApiError.unauthorized();

  const organizations = await listUserOrganizations(user._id, user.isSuperAdmin);
  let activeOrganization = null;
  let membership = null;
  if (req.organizationId) {
    const organization = await Organization.findById(req.organizationId).lean();
    if (organization) activeOrganization = serializeOrganization(organization);
    if (req.membership) {
      const record = await Membership.findById(req.membership.id).lean();
      membership = {
        id: req.membership.id,
        role: req.membership.role,
        permissions: req.membership.permissions,
        title: record?.title,
      };
    }
  }

  return sendSuccess(res, {
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
      avatarUrl: user.avatarUrl,
      phone: user.phone,
      jobTitle: user.jobTitle,
      timezone: user.timezone,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    },
    activeOrganization,
    membership,
    organizations,
  });
});

export const switchOrg = asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const session = await switchOrganization(
    req.user.id,
    req.user.isSuperAdmin,
    req.body.organizationId,
    refreshTokenFromRequest(req),
    requestMeta(req),
  );
  return respondSession(req, res, session);
});

export const updateProfile = asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { $set: req.body },
    { new: true, runValidators: true },
  );
  if (!user) throw ApiError.notFound('User');
  return sendSuccess(res, {
    id: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone,
    jobTitle: user.jobTitle,
    avatarUrl: user.avatarUrl,
    timezone: user.timezone,
  });
});

export const changePasswordHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  await changePassword(req.user.id, req.body.currentPassword, req.body.newPassword);
  clearRefreshCookie(res);
  return sendSuccess(res, { changed: true, reloginRequired: true });
});

export const logoutAll = asyncHandler(async (req, res) => {
  if (!req.user) throw ApiError.unauthorized();
  await revokeAllUserSessions(req.user.id);
  clearRefreshCookie(res);
  return sendSuccess(res, { loggedOut: true });
});

export const permissionsCatalog = asyncHandler(async (req, res) => {
  return sendSuccess(res, {
    roles: ROLES.map((role) => ({
      key: role,
      label: ROLE_LABELS[role],
      permissions:
        role === 'super_admin'
          ? ['*']
          : effectivePermissions(role, [], []),
    })),
    current: req.membership?.permissions ?? [],
  });
});

export const appConfig = asyncHandler(async (_req, res) => {
  return sendSuccess(res, {
    appName: env.APP_NAME,
    version: env.APP_VERSION,
    environment: env.NODE_ENV,
    currency: env.DEFAULT_CURRENCY,
    tenancyBaseDomain: env.TENANCY_BASE_DOMAIN,
  });
});

export const sessionMeta = asyncHandler(async (req, res) => {
  return sendCreated(res, { ok: true, userId: req.user?.id });
});
