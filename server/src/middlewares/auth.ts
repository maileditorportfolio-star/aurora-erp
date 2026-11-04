import type { Request } from 'express';
import { Membership, Organization, User } from '../models';
import { effectivePermissions } from '../config/permissions';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { verifyAccessToken } from '../utils/jwt';

function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

export const authenticate = asyncHandler(async (req, _res, next) => {
  const token = bearerToken(req);
  if (!token) throw ApiError.unauthorized();

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw ApiError.unauthorized('Session expired or token invalid');
  }

  const user = await User.findById(payload.sub).select('+passwordHash').lean();
  if (!user) throw ApiError.unauthorized('Account no longer exists');
  if (user.status === 'suspended') throw ApiError.forbidden('Your account is suspended');
  if (user.status !== 'active' && !user.isSuperAdmin) {
    throw ApiError.forbidden('Your account is not active');
  }

  req.user = {
    id: String(user._id),
    name: user.name,
    email: user.email,
    isSuperAdmin: user.isSuperAdmin,
    status: user.status,
    avatarUrl: user.avatarUrl,
  };
  req.requestId = req.requestId ?? '';

  if (payload.orgId) {
    const organization = await Organization.findById(payload.orgId).lean();
    if (!organization) throw ApiError.unauthorized('Organization no longer exists');
    if (['suspended', 'cancelled'].includes(organization.status) && !user.isSuperAdmin) {
      throw ApiError.forbidden('This organization is suspended');
    }

    req.organizationId = String(organization._id);
    req.tenantOrganization = organization as Express.Request['tenantOrganization'];

    if (payload.membershipId) {
      const membership = await Membership.findOne({
        _id: payload.membershipId,
        user: user._id,
        organization: organization._id,
      }).lean();
      if (!membership || membership.status !== 'active') {
        throw ApiError.forbidden('Your membership in this organization is inactive');
      }
      req.membership = {
        id: String(membership._id),
        organizationId: String(membership.organization),
        role: membership.role,
        permissions: effectivePermissions(
          membership.role,
          membership.permissions?.grants,
          membership.permissions?.revokes,
        ),
        status: membership.status,
      };
    } else if (user.isSuperAdmin) {
      req.membership = {
        id: 'super',
        organizationId: String(organization._id),
        role: 'super_admin',
        permissions: ['*'],
        status: 'active',
      };
    } else {
      throw ApiError.forbidden('No role assigned for this organization');
    }
  } else if (!user.isSuperAdmin) {
    throw ApiError.forbidden('No active organization selected');
  }

  next();
});

export const optionalAuthenticate = asyncHandler(async (req, _res, next) => {
  if (!bearerToken(req)) return next();
  const token = bearerToken(req)!;
  try {
    verifyAccessToken(token);
  } catch {
    return next();
  }
  return authenticate(req, _res, next);
});
