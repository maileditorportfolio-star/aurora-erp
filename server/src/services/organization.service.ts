import { Types } from 'mongoose';
import { DEFAULT_ACCOUNTS } from '../config/accounts';
import { env } from '../config/env';
import { effectivePermissions } from '../config/permissions';
import { Account, Category, Warehouse } from '../models';
import { createNotification } from './notification.service';

/**
 * Creates the baseline configuration every new tenant needs: chart of accounts,
 * a default warehouse and a starter product category. Safe to call repeatedly.
 */
export async function bootstrapOrganization(organizationId: Types.ObjectId | string): Promise<void> {
  const organization = new Types.ObjectId(String(organizationId));

  const existingAccounts = await Account.countDocuments({ organization });
  if (existingAccounts === 0) {
    await Account.insertMany(
      DEFAULT_ACCOUNTS.map((account) => ({
        organization,
        ...account,
        isGroup: false,
        isActive: true,
        isSystem: true,
      })),
    );
  }

  const warehouseCount = await Warehouse.countDocuments({ organization });
  if (warehouseCount === 0) {
    await Warehouse.create({
      organization,
      name: 'Main Warehouse',
      code: 'MAIN',
      isDefault: true,
      isActive: true,
      address: { country: 'United States' },
    });
  }

  const categoryCount = await Category.countDocuments({ organization });
  if (categoryCount === 0) {
    await Category.create({
      organization,
      name: 'General',
      code: 'GEN',
      description: 'Default product category',
      color: '#6366f1',
    });
  }

  await createNotification({
    organization,
    type: 'info',
    title: 'Welcome to Aurora ERP',
    message: 'Your workspace is ready. Complete your organization profile to get started.',
    link: '/settings/organization',
  });
}

export function serializeOrganization(organization: {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  legalName?: string;
  email?: string;
  phone?: string;
  logoUrl?: string;
  brandColor?: string;
  appName?: string;
  plan: string;
  status: string;
  settings?: unknown;
}) {
  return {
    id: String(organization._id),
    name: organization.name,
    slug: organization.slug,
    legalName: organization.legalName,
    email: organization.email,
    phone: organization.phone,
    logoUrl: organization.logoUrl,
    brandColor: organization.brandColor,
    appName: organization.appName ?? organization.name,
    plan: organization.plan,
    status: organization.status,
    settings: (organization.settings as Record<string, unknown> | undefined) ?? {},
  };
}

export function defaultBrandingSettings() {
  return {
    currency: env.DEFAULT_CURRENCY,
    taxRate: env.DEFAULT_TAX_RATE,
    invoiceDueDays: env.INVOICE_DUE_DAYS,
  };
}

export function permissionSummary(role: Parameters<typeof effectivePermissions>[0]) {
  return effectivePermissions(role);
}
