export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
  unread?: number;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  details?: unknown;
  meta?: PaginationMeta & Record<string, unknown>;
  requestId?: string;
}

export type RoleKey = 'super_admin' | 'org_admin' | 'manager' | 'employee' | 'accountant';

export interface User {
  id: string;
  name: string;
  email: string;
  isSuperAdmin: boolean;
  avatarUrl?: string;
  phone?: string;
  jobTitle?: string;
  timezone?: string;
  lastLoginAt?: string;
  createdAt?: string;
  status?: string;
}

export interface OrganizationSettings {
  currency?: string;
  timezone?: string;
  locale?: string;
  dateFormat?: string;
  taxRate?: number;
  invoicePrefix?: string;
  quotationPrefix?: string;
  salesOrderPrefix?: string;
  purchaseOrderPrefix?: string;
  fiscalYearStart?: number;
  invoiceDueDays?: number;
  industry?: string;
  website?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  legalName?: string;
  email?: string;
  phone?: string;
  logoUrl?: string;
  brandColor?: string;
  appName: string;
  plan: string;
  status: string;
  settings: OrganizationSettings;
  role?: RoleKey;
}

export interface Membership {
  id: string;
  role: RoleKey;
  permissions: string[];
  title?: string;
  organizationId?: string;
  status?: string;
}

export interface SessionPayload {
  accessToken?: string;
  refreshToken?: string;
  refreshTokenExpiresAt?: string;
  user: User;
  activeOrganization: Organization | null;
  membership: Membership | null;
  organizations: Organization[];
}

export interface MePayload {
  user: User;
  activeOrganization: Organization | null;
  membership: Membership | null;
  organizations: Organization[];
}

export interface BaseDocument {
  id: string;
  createdAt: string;
  updatedAt: string;
  organization?: string;
}

export interface NamedDocument extends BaseDocument {
  name: string;
  description?: string;
  status?: string;
}

export interface LineItem {
  id?: string;
  product?: string | null;
  description?: string;
  quantity: number;
  unitPrice: number;
  unitCost?: number;
  discountRate: number;
  taxRate: number;
  discount?: number;
  tax?: number;
  total?: number;
}

export interface DocumentRecord extends BaseDocument {
  number: string;
  date?: string;
  issueDate?: string;
  dueDate?: string;
  validUntil?: string;
  status: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  amountPaid?: number;
  balance?: number;
  items: LineItem[];
  customer?: { id?: string; name?: string; company?: string; email?: string } | string;
  supplier?: { id?: string; name?: string; company?: string; email?: string } | string;
  notes?: string;
  terms?: string;
}

export interface DashboardData {
  metrics: {
    revenue: number;
    expenses: number;
    profit: number;
    receivables: number;
    payables: number;
    cashBalance: number;
    activeCustomers: number;
    pendingOrders: number;
    inventoryAlerts: number;
    overdueInvoices: number;
  };
  changes: {
    revenue: number;
    expenses: number;
    profit: number;
    customersNew: number;
    ordersNew: number;
  };
  monthlyFinancials: Array<{
    month: string;
    label: string;
    revenue: number;
    expenses: number;
    profit: number;
  }>;
  cashflow: Array<{
    month: string;
    label: string;
    inflow: number;
    outflow: number;
    net: number;
  }>;
  salesFunnel: Array<{ stage: string; value: number }>;
  inventoryLevels: Array<{
    name: string;
    stock: number;
    reserved: number;
    reorderPoint: number;
    unit: string;
  }>;
  lowStock: Array<{
    id: string;
    name: string;
    sku: string;
    stock: number;
    reorderPoint: number;
    category?: string;
    unit: string;
  }>;
  recentInvoices: Array<{
    id: string;
    number: string;
    customer: string;
    date: string;
    dueDate: string;
    total: number;
    balance: number;
    status: string;
  }>;
  recentActivity: Array<{
    id: string;
    actor?: string;
    action: string;
    resource: string;
    createdAt: string;
    statusCode?: number;
  }>;
  topProducts: Array<{ name: string; sku: string; quantity: number; revenue: number }>;
  topExpenses: Array<{ name: string; total: number }>;
  generatedAt: string;
}

export interface NotificationRecord {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

export interface ReportPeriod {
  from?: string;
  to?: string;
}

export interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  [key: string]: string | number | boolean | undefined | null;
}
