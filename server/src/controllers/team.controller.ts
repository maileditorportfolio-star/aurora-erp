import crypto from 'node:crypto';
import { Types } from 'mongoose';
import { Membership, Organization, User } from '../models';
import { asyncHandler } from '../utils/asyncHandler';
import { parsePagination, searchFilter } from '../utils/pagination';
import { sendCreated, sendPaginated, sendSuccess } from '../utils/response';
import { ApiError } from '../utils/ApiError';
import { hashPassword } from '../utils/password';
import { ALL_PERMISSIONS, effectivePermissions } from '../config/permissions';
import { createNotification } from '../services/notification.service';

async function assertNotLastAdmin(organizationId: string, membershipId: string) {
  const target = await Membership.findOne({ _id: membershipId, organization: organizationId }).lean();
  if (!target) throw ApiError.notFound('Team member');
  if (target.role !== 'org_admin') return target;
  const admins = await Membership.countDocuments({
    organization: organizationId,
    role: 'org_admin',
    status: 'active',
    _id: { $ne: target._id },
  });
  if (admins === 0) throw ApiError.validation('At least one active organization admin is required');
  return target;
}

export const teamController = {
  list: asyncHandler(async (req, res) => {
    const pagination = parsePagination(req.query as Record<string, unknown>, {
      defaultSort: 'createdAt',
    });
    const filter: Record<string, unknown> = { organization: req.organizationId };
    if (req.query.role) filter.role = req.query.role;
    if (req.query.status) filter.status = req.query.status;
    const memberMatch = searchFilter(pagination.search, ['title']);
    if (Object.keys(memberMatch).length) Object.assign(filter, memberMatch);

    const memberships = await Membership.find(filter)
      .populate('user', 'name email avatarUrl status lastLoginAt')
      .populate('invitedBy', 'name')
      .sort({ createdAt: 1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean();

    return sendPaginated(
      res,
      memberships.map((membership) => ({
        ...membership,
        effectivePermissions: effectivePermissions(
          membership.role,
          membership.permissions?.grants,
          membership.permissions?.revokes,
        ),
      })),
      pagination.meta(await Membership.countDocuments(filter)),
    );
  }),

  invite: asyncHandler(async (req, res) => {
    const email = String(req.body.email).toLowerCase().trim();
    let user = await User.findOne({ email });
    let temporaryPassword: string | undefined;

    if (!user) {
      temporaryPassword =
        req.body.password ??
        `${crypto.randomBytes(9).toString('base64url').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)}Aa1!`;
      user = await User.create({
        name: req.body.name,
        email,
        passwordHash: await hashPassword(temporaryPassword!),
        status: 'active',
        mustChangePassword: true,
      });
    }

    const existingMembership = await Membership.findOne({
      organization: req.organizationId,
      user: user._id,
    });
    if (existingMembership) throw ApiError.conflict('This person is already a member of the workspace');

    const membership = await Membership.create({
      organization: req.organizationId!,
      user: user._id,
      role: req.body.role,
      title: req.body.title,
      status: 'active',
      permissions: { grants: [], revokes: [] },
      invitedBy: req.user?.id,
      joinedAt: new Date(),
    });

    await createNotification({
      organization: new Types.ObjectId(req.organizationId!),
      user: user._id,
      type: 'info',
      title: 'Welcome to the team',
      message: `You were added as ${req.body.role.replaceAll('_', ' ')}.`,
      link: '/dashboard',
    });

    const populated = await Membership.findById(membership._id)
      .populate('user', 'name email avatarUrl status lastLoginAt')
      .lean();

    return sendCreated(res, {
      member: populated,
      temporaryPassword,
      note: temporaryPassword
        ? 'Share this temporary password securely. The user must change it after signing in.'
        : 'Existing account added to this workspace.',
    });
  }),

  update: asyncHandler(async (req, res) => {
    const membership = await Membership.findOne({
      _id: req.params.id,
      organization: req.organizationId,
    });
    if (!membership) throw ApiError.notFound('Team member');

    if (String(membership.user) === req.user?.id) {
      if (req.body.role && req.body.role !== membership.role) {
        throw ApiError.validation('You cannot change your own role');
      }
      if (req.body.status && req.body.status !== membership.status) {
        throw ApiError.validation('You cannot change your own membership status');
      }
    }
    if (req.body.role && req.body.role !== 'org_admin') {
      await assertNotLastAdmin(req.organizationId!, String(req.params.id));
    }
    if (req.body.status === 'suspended') {
      await assertNotLastAdmin(req.organizationId!, String(req.params.id));
    }

    if (req.body.role) membership.role = req.body.role;
    if (req.body.title !== undefined) membership.title = req.body.title;
    if (req.body.status) membership.status = req.body.status;
    if (req.body.permissions) {
      const grants = (req.body.permissions.grants ?? []).filter((permission: string) =>
        ALL_PERMISSIONS.includes(permission as never),
      );
      const revokes = (req.body.permissions.revokes ?? []).filter((permission: string) =>
        ALL_PERMISSIONS.includes(permission as never),
      );
      membership.permissions = { grants, revokes };
    }
    await membership.save();

    if (req.body.status === 'suspended') {
      const { revokeAllUserSessions } = await import('../services/auth.service');
      await revokeAllUserSessions(String(membership.user));
    }

    const populated = await Membership.findById(membership._id)
      .populate('user', 'name email avatarUrl status lastLoginAt')
      .lean();
    return sendSuccess(res, {
      ...populated,
      effectivePermissions: effectivePermissions(
        membership.role,
        membership.permissions.grants,
        membership.permissions.revokes,
      ),
    });
  }),

  remove: asyncHandler(async (req, res) => {
    const membership = await Membership.findOne({
      _id: req.params.id,
      organization: req.organizationId,
    });
    if (!membership) throw ApiError.notFound('Team member');
    if (String(membership.user) === req.user?.id) {
      throw ApiError.validation('You cannot remove yourself from the workspace');
    }
    await assertNotLastAdmin(req.organizationId!, String(req.params.id));
    await Membership.deleteOne({ _id: membership._id });
    return sendSuccess(res, { id: req.params.id, removed: true });
  }),

  permissions: asyncHandler(async (_req, res) => {
    return sendSuccess(res, { permissions: ALL_PERMISSIONS });
  }),
};

export const _organizationModel = Organization;
