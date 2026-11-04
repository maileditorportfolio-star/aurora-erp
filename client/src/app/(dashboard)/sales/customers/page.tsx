'use client';

import { z } from 'zod';
import { ResourcePage } from '@/components/crud/resource-page';
import { ResourceDialog } from '@/components/crud/resource-dialog';
import { StatusBadge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/use-auth';
import { useSaveResource } from '@/hooks/use-save-resource';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { PERMISSIONS } from '@/lib/permissions';
import { optionalEmail, optionalNumber, optionalString } from '@/lib/validation';
import type { ResourceFormRendererProps } from '@/components/crud/resource-page';

interface Customer {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  code?: string;
  taxId?: string;
  currency?: string;
  creditLimit?: number;
  balance?: number;
  status?: string;
  createdAt?: string;
  billingAddress?: { street?: string; city?: string; country?: string };
}

const schema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(160),
  company: optionalString,
  email: optionalEmail,
  phone: optionalString,
  code: optionalString,
  taxId: optionalString,
  currency: z.string().length(3).optional(),
  creditLimit: optionalNumber,
  status: z.enum(['active', 'inactive', 'blocked']).optional(),
  billingAddress: z
    .object({
      street: optionalString,
      city: optionalString,
      country: optionalString,
    })
    .optional(),
  notes: optionalString,
});

const FIELDS = [
  { name: 'name', label: 'Customer name', required: true, placeholder: 'Northwind Traders' },
  { name: 'company', label: 'Company', placeholder: 'Legal entity name' },
  { name: 'email', label: 'Email', type: 'email' as const, placeholder: 'billing@company.com' },
  { name: 'phone', label: 'Phone', type: 'tel' as const, placeholder: '+1 555 000 0000' },
  { name: 'code', label: 'Customer code', hint: 'Leave blank to auto-generate' },
  { name: 'taxId', label: 'Tax ID' },
  {
    name: 'currency',
    label: 'Currency',
    type: 'select' as const,
    options: ['USD', 'EUR', 'GBP', 'AED', 'CAD', 'AUD'].map((value) => ({ value, label: value })),
  },
  { name: 'creditLimit', label: 'Credit limit', type: 'number' as const, step: '0.01' },
  {
    name: 'status',
    label: 'Status',
    type: 'select' as const,
    options: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
      { value: 'blocked', label: 'Blocked' },
    ],
  },
  { name: 'billingAddress.street', label: 'Billing street', colSpan: 2 as const },
  { name: 'billingAddress.city', label: 'City' },
  { name: 'billingAddress.country', label: 'Country' },
  { name: 'notes', label: 'Notes', type: 'textarea' as const, colSpan: 2 as const },
];

export default function CustomersPage() {
  const { can, activeOrganization } = useAuth();
  const currency = activeOrganization?.settings?.currency || 'USD';

  return (
    <ResourcePage<Customer>
      title="Customers"
      description="Every buyer, contact and credit profile in one place."
      endpoint="/customers"
      createLabel="New customer"
      searchPlaceholder="Search customers…"
      canCreate={can(PERMISSIONS.CUSTOMERS_WRITE)}
      canEdit={can(PERMISSIONS.CUSTOMERS_WRITE)}
      canDelete={can(PERMISSIONS.CUSTOMERS_DELETE)}
      emptyDescription="Add your first customer to start quoting and invoicing."
      deleteDescription={(customer) => `${customer.name} will be removed from active lists.`}
      columns={[
        {
          key: 'name',
          header: 'Customer',
          cell: (customer) => (
            <div>
              <p className="font-medium">{customer.name}</p>
              <p className="text-[11px] text-muted-foreground">{customer.company || customer.code || '—'}</p>
            </div>
          ),
        },
        { key: 'email', header: 'Contact', cell: (customer) => (
          <div>
            <p>{customer.email || '—'}</p>
            <p className="text-[11px] text-muted-foreground">{customer.phone || ''}</p>
          </div>
        ) },
        { key: 'balance', header: 'Balance', align: 'right', cell: (customer) => formatCurrency(customer.balance ?? 0, currency) },
        { key: 'credit', header: 'Credit limit', align: 'right', cell: (customer) => formatCurrency(customer.creditLimit ?? 0, currency) },
        { key: 'status', header: 'Status', cell: (customer) => <StatusBadge status={customer.status} /> },
        { key: 'created', header: 'Added', cell: (customer) => <span className="text-muted-foreground">{formatDate(customer.createdAt)}</span> },
      ]}
      renderForm={({ record, open, onOpenChange }: ResourceFormRendererProps<Customer>) => (
        <CustomerDialog record={record} open={open} onOpenChange={onOpenChange} defaultCurrency={currency} />
      )}
    />
  );
}

function CustomerDialog({
  record,
  open,
  onOpenChange,
  defaultCurrency,
}: {
  record: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCurrency: string;
}) {
  const { save } = useSaveResource('/customers', record?.id);

  return (
    <ResourceDialog
      open={open}
      onOpenChange={onOpenChange}
      title={record ? 'Edit customer' : 'New customer'}
      description="Customer details are used on quotations, orders and invoices."
      schema={schema}
      fields={FIELDS}
      record={{ currency: defaultCurrency, status: 'active', ...record }}
      submitLabel={record ? 'Save changes' : 'Create customer'}
      onSubmit={async (values) => {
        await save(values);
      }}
    />
  );
}
