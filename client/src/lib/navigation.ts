import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  BookOpen,
  BookText,
  Boxes,
  Building2,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileText,
  LayoutDashboard,
  Package,
  ReceiptText,
  ScrollText,
  ShieldCheck,
  ShoppingCart,
  Tags,
  Truck,
  UserRound,
  Users,
  Wallet,
  Warehouse,
} from 'lucide-react';
import { PERMISSIONS } from './permissions';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: string;
  superAdminOnly?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      {
        label: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        permission: PERMISSIONS.DASHBOARD_READ,
      },
    ],
  },
  {
    label: 'Sales',
    items: [
      {
        label: 'Customers',
        href: '/sales/customers',
        icon: Users,
        permission: PERMISSIONS.CUSTOMERS_READ,
      },
      {
        label: 'Quotations',
        href: '/sales/quotations',
        icon: FileText,
        permission: PERMISSIONS.QUOTATIONS_READ,
      },
      {
        label: 'Sales orders',
        href: '/sales/orders',
        icon: ShoppingCart,
        permission: PERMISSIONS.SALES_ORDERS_READ,
      },
      {
        label: 'Invoices',
        href: '/sales/invoices',
        icon: ReceiptText,
        permission: PERMISSIONS.INVOICES_READ,
      },
      {
        label: 'Payments',
        href: '/sales/payments',
        icon: CreditCard,
        permission: PERMISSIONS.PAYMENTS_READ,
      },
    ],
  },
  {
    label: 'Inventory',
    items: [
      {
        label: 'Products',
        href: '/inventory/products',
        icon: Package,
        permission: PERMISSIONS.PRODUCTS_READ,
      },
      {
        label: 'Categories',
        href: '/inventory/categories',
        icon: Tags,
        permission: PERMISSIONS.CATEGORIES_READ,
      },
      {
        label: 'Warehouses',
        href: '/inventory/warehouses',
        icon: Warehouse,
        permission: PERMISSIONS.WAREHOUSES_READ,
      },
      {
        label: 'Stock levels',
        href: '/inventory/stock',
        icon: Boxes,
        permission: PERMISSIONS.INVENTORY_READ,
      },
    ],
  },
  {
    label: 'Purchasing',
    items: [
      {
        label: 'Vendors',
        href: '/purchases/suppliers',
        icon: Truck,
        permission: PERMISSIONS.SUPPLIERS_READ,
      },
      {
        label: 'Purchase orders',
        href: '/purchases/orders',
        icon: ClipboardList,
        permission: PERMISSIONS.PURCHASE_ORDERS_READ,
      },
      {
        label: 'Goods receipts',
        href: '/purchases/receipts',
        icon: ClipboardCheck,
        permission: PERMISSIONS.GOODS_RECEIPTS_READ,
      },
      {
        label: 'Vendor bills',
        href: '/purchases/bills',
        icon: ReceiptText,
        permission: PERMISSIONS.BILLS_READ,
      },
    ],
  },
  {
    label: 'Finance',
    items: [
      {
        label: 'Chart of accounts',
        href: '/finance/accounts',
        icon: BookOpen,
        permission: PERMISSIONS.ACCOUNTS_READ,
      },
      {
        label: 'Transactions',
        href: '/finance/transactions',
        icon: ArrowLeftRight,
        permission: PERMISSIONS.TRANSACTIONS_READ,
      },
      {
        label: 'Journal',
        href: '/finance/journal',
        icon: BookText,
        permission: PERMISSIONS.JOURNAL_READ,
      },
      {
        label: 'Reports',
        href: '/finance/reports',
        icon: BarChart3,
        permission: PERMISSIONS.REPORTS_READ,
      },
    ],
  },
  {
    label: 'People',
    items: [
      {
        label: 'Employees',
        href: '/hr/employees',
        icon: UserRound,
        permission: PERMISSIONS.EMPLOYEES_READ,
      },
      {
        label: 'Attendance',
        href: '/hr/attendance',
        icon: CalendarCheck,
        permission: PERMISSIONS.ATTENDANCE_READ,
      },
      {
        label: 'Leave requests',
        href: '/hr/leaves',
        icon: CalendarDays,
        permission: PERMISSIONS.LEAVES_READ,
      },
      {
        label: 'Payroll',
        href: '/hr/payroll',
        icon: Wallet,
        permission: PERMISSIONS.PAYROLL_READ,
      },
    ],
  },
  {
    label: 'Workspace',
    items: [
      {
        label: 'Team & roles',
        href: '/team',
        icon: ShieldCheck,
        permission: PERMISSIONS.TEAM_READ,
      },
      {
        label: 'Organization',
        href: '/settings/organization',
        icon: Building2,
        permission: PERMISSIONS.ORGANIZATION_READ,
      },
      {
        label: 'Audit log',
        href: '/settings/audit',
        icon: ScrollText,
        permission: PERMISSIONS.AUDIT_READ,
      },
      {
        label: 'Notifications',
        href: '/notifications',
        icon: Bell,
        permission: PERMISSIONS.NOTIFICATIONS_READ,
      },
    ],
  },
  {
    label: 'Platform',
    items: [
      {
        label: 'Admin console',
        href: '/admin',
        icon: ShieldCheck,
        superAdminOnly: true,
      },
    ],
  },
];
