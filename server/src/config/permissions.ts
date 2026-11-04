/**
 * Granular permission catalogue. Permissions are namespaced as
 * `<resource>:<action>` so they can be granted individually or as wildcards.
 */
export const PERMISSIONS = {
  DASHBOARD_READ: 'dashboard:read',

  PRODUCTS_READ: 'products:read',
  PRODUCTS_WRITE: 'products:write',
  PRODUCTS_DELETE: 'products:delete',
  INVENTORY_READ: 'inventory:read',
  INVENTORY_WRITE: 'inventory:write',
  CATEGORIES_READ: 'categories:read',
  CATEGORIES_WRITE: 'categories:write',
  CATEGORIES_DELETE: 'categories:delete',
  WAREHOUSES_READ: 'warehouses:read',
  WAREHOUSES_WRITE: 'warehouses:write',
  WAREHOUSES_DELETE: 'warehouses:delete',
  SUPPLIERS_READ: 'suppliers:read',
  SUPPLIERS_WRITE: 'suppliers:write',
  SUPPLIERS_DELETE: 'suppliers:delete',

  CUSTOMERS_READ: 'customers:read',
  CUSTOMERS_WRITE: 'customers:write',
  CUSTOMERS_DELETE: 'customers:delete',
  QUOTATIONS_READ: 'quotations:read',
  QUOTATIONS_WRITE: 'quotations:write',
  QUOTATIONS_DELETE: 'quotations:delete',
  SALES_ORDERS_READ: 'sales_orders:read',
  SALES_ORDERS_WRITE: 'sales_orders:write',
  SALES_ORDERS_DELETE: 'sales_orders:delete',
  SALES_ORDERS_APPROVE: 'sales_orders:approve',
  INVOICES_READ: 'invoices:read',
  INVOICES_WRITE: 'invoices:write',
  INVOICES_DELETE: 'invoices:delete',
  INVOICES_VOID: 'invoices:void',
  PAYMENTS_READ: 'payments:read',
  PAYMENTS_WRITE: 'payments:write',
  PAYMENTS_DELETE: 'payments:delete',

  PURCHASE_ORDERS_READ: 'purchase_orders:read',
  PURCHASE_ORDERS_WRITE: 'purchase_orders:write',
  PURCHASE_ORDERS_DELETE: 'purchase_orders:delete',
  PURCHASE_ORDERS_APPROVE: 'purchase_orders:approve',
  GOODS_RECEIPTS_READ: 'goods_receipts:read',
  GOODS_RECEIPTS_WRITE: 'goods_receipts:write',
  GOODS_RECEIPTS_DELETE: 'goods_receipts:delete',
  BILLS_READ: 'bills:read',
  BILLS_WRITE: 'bills:write',
  BILLS_DELETE: 'bills:delete',

  ACCOUNTS_READ: 'accounts:read',
  ACCOUNTS_WRITE: 'accounts:write',
  ACCOUNTS_DELETE: 'accounts:delete',
  TRANSACTIONS_READ: 'transactions:read',
  TRANSACTIONS_WRITE: 'transactions:write',
  TRANSACTIONS_DELETE: 'transactions:delete',
  JOURNAL_READ: 'journal:read',
  JOURNAL_WRITE: 'journal:write',
  REPORTS_READ: 'reports:read',

  EMPLOYEES_READ: 'employees:read',
  EMPLOYEES_WRITE: 'employees:write',
  EMPLOYEES_DELETE: 'employees:delete',
  ATTENDANCE_READ: 'attendance:read',
  ATTENDANCE_WRITE: 'attendance:write',
  LEAVES_READ: 'leaves:read',
  LEAVES_WRITE: 'leaves:write',
  LEAVES_APPROVE: 'leaves:approve',
  PAYROLL_READ: 'payroll:read',
  PAYROLL_WRITE: 'payroll:write',
  PAYROLL_APPROVE: 'payroll:approve',

  TEAM_READ: 'team:read',
  TEAM_WRITE: 'team:write',
  TEAM_DELETE: 'team:delete',
  ORGANIZATION_READ: 'organization:read',
  ORGANIZATION_WRITE: 'organization:write',
  AUDIT_READ: 'audit:read',
  NOTIFICATIONS_READ: 'notifications:read',
  PLATFORM_ADMIN: 'platform:admin',
  LICENSE_MANAGE: 'license:manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
export const ALL_PERMISSIONS = Object.values(PERMISSIONS);

export const ROLES = ['super_admin', 'org_admin', 'manager', 'employee', 'accountant'] as const;
export type RoleKey = (typeof ROLES)[number];

export const ROLE_LABELS: Record<RoleKey, string> = {
  super_admin: 'Super Admin',
  org_admin: 'Organization Admin',
  manager: 'Manager',
  employee: 'Employee',
  accountant: 'Accountant',
};

const managerPermissions: Permission[] = [
  PERMISSIONS.DASHBOARD_READ,
  PERMISSIONS.PRODUCTS_READ,
  PERMISSIONS.PRODUCTS_WRITE,
  PERMISSIONS.PRODUCTS_DELETE,
  PERMISSIONS.INVENTORY_READ,
  PERMISSIONS.INVENTORY_WRITE,
  PERMISSIONS.CATEGORIES_READ,
  PERMISSIONS.CATEGORIES_WRITE,
  PERMISSIONS.CATEGORIES_DELETE,
  PERMISSIONS.WAREHOUSES_READ,
  PERMISSIONS.WAREHOUSES_WRITE,
  PERMISSIONS.SUPPLIERS_READ,
  PERMISSIONS.SUPPLIERS_WRITE,
  PERMISSIONS.CUSTOMERS_READ,
  PERMISSIONS.CUSTOMERS_WRITE,
  PERMISSIONS.CUSTOMERS_DELETE,
  PERMISSIONS.QUOTATIONS_READ,
  PERMISSIONS.QUOTATIONS_WRITE,
  PERMISSIONS.QUOTATIONS_DELETE,
  PERMISSIONS.SALES_ORDERS_READ,
  PERMISSIONS.SALES_ORDERS_WRITE,
  PERMISSIONS.SALES_ORDERS_APPROVE,
  PERMISSIONS.SALES_ORDERS_DELETE,
  PERMISSIONS.INVOICES_READ,
  PERMISSIONS.INVOICES_WRITE,
  PERMISSIONS.INVOICES_VOID,
  PERMISSIONS.PAYMENTS_READ,
  PERMISSIONS.PAYMENTS_WRITE,
  PERMISSIONS.PURCHASE_ORDERS_READ,
  PERMISSIONS.PURCHASE_ORDERS_WRITE,
  PERMISSIONS.PURCHASE_ORDERS_APPROVE,
  PERMISSIONS.GOODS_RECEIPTS_READ,
  PERMISSIONS.GOODS_RECEIPTS_WRITE,
  PERMISSIONS.BILLS_READ,
  PERMISSIONS.EMPLOYEES_READ,
  PERMISSIONS.ATTENDANCE_READ,
  PERMISSIONS.ATTENDANCE_WRITE,
  PERMISSIONS.LEAVES_READ,
  PERMISSIONS.LEAVES_APPROVE,
  PERMISSIONS.PAYROLL_READ,
  PERMISSIONS.REPORTS_READ,
  PERMISSIONS.TEAM_READ,
  PERMISSIONS.ORGANIZATION_READ,
  PERMISSIONS.AUDIT_READ,
  PERMISSIONS.NOTIFICATIONS_READ,
];

const accountantPermissions: Permission[] = [
  PERMISSIONS.DASHBOARD_READ,
  PERMISSIONS.CUSTOMERS_READ,
  PERMISSIONS.QUOTATIONS_READ,
  PERMISSIONS.SALES_ORDERS_READ,
  PERMISSIONS.INVOICES_READ,
  PERMISSIONS.INVOICES_WRITE,
  PERMISSIONS.INVOICES_VOID,
  PERMISSIONS.PAYMENTS_READ,
  PERMISSIONS.PAYMENTS_WRITE,
  PERMISSIONS.PAYMENTS_DELETE,
  PERMISSIONS.SUPPLIERS_READ,
  PERMISSIONS.PURCHASE_ORDERS_READ,
  PERMISSIONS.GOODS_RECEIPTS_READ,
  PERMISSIONS.BILLS_READ,
  PERMISSIONS.BILLS_WRITE,
  PERMISSIONS.BILLS_DELETE,
  PERMISSIONS.ACCOUNTS_READ,
  PERMISSIONS.ACCOUNTS_WRITE,
  PERMISSIONS.ACCOUNTS_DELETE,
  PERMISSIONS.TRANSACTIONS_READ,
  PERMISSIONS.TRANSACTIONS_WRITE,
  PERMISSIONS.TRANSACTIONS_DELETE,
  PERMISSIONS.JOURNAL_READ,
  PERMISSIONS.JOURNAL_WRITE,
  PERMISSIONS.REPORTS_READ,
  PERMISSIONS.EMPLOYEES_READ,
  PERMISSIONS.ATTENDANCE_READ,
  PERMISSIONS.PAYROLL_READ,
  PERMISSIONS.PAYROLL_WRITE,
  PERMISSIONS.ORGANIZATION_READ,
  PERMISSIONS.NOTIFICATIONS_READ,
];

const employeePermissions: Permission[] = [
  PERMISSIONS.DASHBOARD_READ,
  PERMISSIONS.PRODUCTS_READ,
  PERMISSIONS.INVENTORY_READ,
  PERMISSIONS.CUSTOMERS_READ,
  PERMISSIONS.QUOTATIONS_READ,
  PERMISSIONS.SALES_ORDERS_READ,
  PERMISSIONS.INVOICES_READ,
  PERMISSIONS.ATTENDANCE_READ,
  PERMISSIONS.LEAVES_READ,
  PERMISSIONS.LEAVES_WRITE,
  PERMISSIONS.PAYROLL_READ,
  PERMISSIONS.NOTIFICATIONS_READ,
];

export const ROLE_PERMISSIONS: Record<RoleKey, Permission[]> = {
  super_admin: ALL_PERMISSIONS as Permission[],
  org_admin: ALL_PERMISSIONS.filter(
    (permission) =>
      permission !== PERMISSIONS.PLATFORM_ADMIN && permission !== PERMISSIONS.LICENSE_MANAGE,
  ) as Permission[],
  manager: managerPermissions,
  employee: employeePermissions,
  accountant: accountantPermissions,
};

export function effectivePermissions(
  role: RoleKey,
  grants: string[] = [],
  revokes: string[] = [],
): string[] {
  const permissions = new Set<string>(role === 'super_admin' ? ['*'] : ROLE_PERMISSIONS[role]);
  for (const grant of grants) {
    if (ALL_PERMISSIONS.includes(grant as Permission) || grant === '*') permissions.add(grant);
  }
  for (const revoke of revokes) permissions.delete(revoke);
  return [...permissions];
}

export function hasPermission(permissions: string[] | undefined, required: string): boolean {
  if (!permissions) return false;
  return permissions.includes('*') || permissions.includes(required);
}

export function hasAnyPermission(permissions: string[] | undefined, required: string[]): boolean {
  return required.some((permission) => hasPermission(permissions, permission));
}
