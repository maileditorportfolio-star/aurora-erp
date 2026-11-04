import crypto from 'node:crypto';
import { Types } from 'mongoose';
import { AuditLog, Invoice, Membership, Organization, User } from '../models';
import { asyncHandler } from '../utils/asyncHandler';
import { parsePagination, searchFilter } from '../utils/pagination';
import { sendCreated, sendPaginated, sendSuccess } from '../utils/response';
import { ApiError } from '../utils/ApiError';
import { assertOrganizationAllowed, getLicenseStatus } from '../utils/license';
import { bootstrapOrganization } from '../services/organization.service';
import { env } from '../config/env';

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export const adminController = {
  organizations: asyncHandler(async (req, res) => {
    const pagination = parsePagination(req.query as Record<string, unknown>, {
      defaultSort: '-createdAt',
    });
    const match: Record<string, unknown> = { ...searchFilter(pagination.search, ['name', 'slug', 'email']) };
    if (req.query.status) match.status = req.query.status;
    if (req.query.plan) match.plan = req.query.plan;
    const [items, total] = await Promise.all([
      Organization.aggregate([
        { $match: match },
        { $sort: { [Object.keys(pagination.sort)[0] ?? 'createdAt']: Object.values(pagination.sort)[0] ?? -1 } },
        { $skip: pagination.skip },
        { $limit: pagination.limit },
        {
          $lookup: {
            from: 'memberships',
            localField: '_id',
            foreignField: 'organization',
            as: 'members',
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'owner',
            foreignField: '_id',
            as: 'ownerUser',
          },
        },
        {
          $lookup: {
            from: 'invoices',
            localField: '_id',
            foreignField: 'organization',
            as: 'invoices',
          },
        },
        {
          $project: {
            name: 1,
            slug: 1,
            email: 1,
            plan: 1,
            status: 1,
            logoUrl: 1,
            brandColor: 1,
            createdAt: 1,
            trialEndsAt: 1,
            memberCount: { $size: '$members' },
            owner: { $arrayElemAt: ['$ownerUser', 0] },
            invoiceCount: { $size: '$invoices' },
            revenue: {
              $sum: {
                $map: {
                  input: {
                    $filter: {
                      input: '$invoices',
                      as: 'invoice',
                      cond: { $and: [{ $ne: ['$$invoice.status', 'void'] }, { $ne: ['$$invoice.isDeleted', true] }] },
                    },
                  },
                  as: 'invoice',
                  in: '$$invoice.total',
                },
              },
            },
          },
        },
      ]),
      Organization.countDocuments(match),
    ]);
    return sendPaginated(res, items, pagination.meta(total));
  }),

  createOrganization: asyncHandler(async (req, res) => {
    const count = await Organization.countDocuments();
    assertOrganizationAllowed(count);
    const owner = await User.findOne({ email: String(req.body.ownerEmail).toLowerCase() }).lean();
    if (!owner) throw ApiError.validation('Owner account does not exist. Create the user first.');
    const slug = req.body.slug ? slugify(req.body.slug) : slugify(req.body.name);
    if (await Organization.exists({ slug })) throw ApiError.conflict('Workspace slug is already taken');
    const organization = await Organization.create({
      name: req.body.name,
      slug,
      owner: owner._id,
      plan: req.body.plan ?? 'professional',
      status: req.body.status ?? 'active',
      email: owner.email,
    });
    await Membership.create({
      organization: organization._id,
      user: owner._id,
      role: 'org_admin',
      status: 'active',
      title: 'Owner',
      joinedAt: new Date(),
    });
    await bootstrapOrganization(organization._id);
    return sendCreated(res, organization.toJSON());
  }),

  updateOrganization: asyncHandler(async (req, res) => {
    const organization = await Organization.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true },
    );
    if (!organization) throw ApiError.notFound('Organization');
    return sendSuccess(res, organization.toJSON());
  }),

  platformStats: asyncHandler(async (_req, res) => {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const [organizations, activeOrganizations, users, revenue, invoices] = await Promise.all([
      Organization.countDocuments(),
      Organization.countDocuments({ status: { $in: ['active', 'trial'] } }),
      User.countDocuments({ status: 'active' }),
      Invoice.aggregate([
        { $match: { status: { $nin: ['void', 'draft'] }, issueDate: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
      Invoice.countDocuments({ issueDate: { $gte: monthStart }, status: { $ne: 'void' } }),
    ]);
    return sendSuccess(res, {
      organizations,
      activeOrganizations,
      users,
      monthRevenue: revenue[0]?.total ?? 0,
      monthInvoices: invoices,
      license: getLicenseStatus(),
    });
  }),

  audits: asyncHandler(async (req, res) => {
    const pagination = parsePagination(req.query as Record<string, unknown>, {
      defaultSort: '-createdAt',
    });
    const filter: Record<string, unknown> = {};
    if (req.query.organization) filter.organization = req.query.organization;
    if (req.query.resource) filter.resource = req.query.resource;
    if (req.query.action) filter.action = req.query.action;
    if (req.query.actor) filter.actor = req.query.actor;
    if (req.query.from || req.query.to) {
      const range: Record<string, Date> = {};
      if (req.query.from) range.$gte = new Date(String(req.query.from));
      if (req.query.to) range.$lte = new Date(String(req.query.to));
      filter.createdAt = range;
    }
    const [items, total] = await Promise.all([
      AuditLog.find(filter)
        .populate('organization', 'name slug')
        .populate('actor', 'name email')
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);
    return sendPaginated(res, items, pagination.meta(total));
  }),

  license: asyncHandler(async (_req, res) => {
    return sendSuccess(res, {
      ...getLicenseStatus(),
      environment: env.NODE_ENV,
      appVersion: env.APP_VERSION,
    });
  }),

  users: asyncHandler(async (req, res) => {
    const pagination = parsePagination(req.query as Record<string, unknown>, {
      defaultSort: '-createdAt',
    });
    const match = searchFilter(pagination.search, ['name', 'email']);
    const [items, total] = await Promise.all([
      User.find(match)
        .select('name email status isSuperAdmin lastLoginAt createdAt avatarUrl')
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      User.countDocuments(match),
    ]);
    return sendPaginated(res, items, pagination.meta(total));
  }),

  toggleSuperAdmin: asyncHandler(async (req, res) => {
    if (String(req.params.id) === req.user?.id) {
      throw ApiError.validation('You cannot change your own platform role');
    }
    const user = await User.findById(req.params.id);
    if (!user) throw ApiError.notFound('User');
    user.isSuperAdmin = !user.isSuperAdmin;
    await user.save();
    return sendSuccess(res, {
      id: String(user._id),
      isSuperAdmin: user.isSuperAdmin,
    });
  }),

  auditStats: asyncHandler(async (req, res) => {
    const organization = req.query.organization
      ? new Types.ObjectId(String(req.query.organization))
      : undefined;
    const match = organization ? { organization } : {};
    const rows = await AuditLog.aggregate([
      { $match: match },
      { $group: { _id: { resource: '$resource', action: '$action' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 12 },
    ]);
    return sendSuccess(res, rows);
  }),
};

export const cryptoRandom = crypto.randomUUID;
