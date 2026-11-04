import { Types } from 'mongoose';
import {
  Customer,
  Employee,
  Invoice,
  Membership,
  Organization,
  Product,
} from '../models';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { ApiError } from '../utils/ApiError';
import { serializeOrganization } from '../services/organization.service';
import { effectivePermissions, ROLE_LABELS, ROLES } from '../config/permissions';

function flattenSettings(settings: Record<string, unknown>): Record<string, unknown> {
  const set: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(settings)) {
    if (key === 'address' && value && typeof value === 'object') {
      for (const [addressKey, addressValue] of Object.entries(value as Record<string, unknown>)) {
        if (addressValue !== undefined) set[`settings.address.${addressKey}`] = addressValue;
      }
    } else if (value !== undefined) {
      set[`settings.${key}`] = value;
    }
  }
  return set;
}

export const organizationController = {
  current: asyncHandler(async (req, res) => {
    const organization = await Organization.findById(req.organizationId)
      .populate('owner', 'name email')
      .lean();
    if (!organization) throw ApiError.notFound('Organization');
    return sendSuccess(res, serializeOrganization(organization as never));
  }),

  update: asyncHandler(async (req, res) => {
    const body = { ...(req.body as Record<string, unknown>) };
    const settings = body.settings as Record<string, unknown> | undefined;
    delete body.settings;
    if (body.plan && !req.user?.isSuperAdmin) delete body.plan;
    if (body.slug) delete body.slug;

    const set: Record<string, unknown> = { ...body };
    if (settings) Object.assign(set, flattenSettings(settings));

    const organization = await Organization.findByIdAndUpdate(
      req.organizationId,
      { $set: set },
      { new: true, runValidators: true },
    ).lean();
    if (!organization) throw ApiError.notFound('Organization');
    return sendSuccess(res, serializeOrganization(organization as never));
  }),

  stats: asyncHandler(async (req, res) => {
    const organization = new Types.ObjectId(req.organizationId);
    const [members, products, customers, invoices, employees] = await Promise.all([
      Membership.countDocuments({ organization, status: 'active' }),
      Product.countDocuments({ organization }),
      Customer.countDocuments({ organization }),
      Invoice.countDocuments({ organization, status: { $ne: 'void' } }),
      Employee.countDocuments({ organization, status: 'active' }),
    ]);
    return sendSuccess(res, { members, products, customers, invoices, employees });
  }),

  roles: asyncHandler(async (req, res) => {
    return sendSuccess(res, {
      roles: ROLES.map((role) => ({
        key: role,
        label: ROLE_LABELS[role],
        permissions: role === 'super_admin' ? ['*'] : effectivePermissions(role),
      })),
      current: req.membership,
    });
  }),
};
