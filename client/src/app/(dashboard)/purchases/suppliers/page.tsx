'use client';

import { z } from 'zod';
import { ResourcePage } from '@/components/crud/resource-page';
import { ResourceDialog, type FormFieldConfig } from '@/components/crud/resource-dialog';
import { StatusBadge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/use-auth';
import { useSaveResource } from '@/hooks/use-save-resource';
import { formatCurrency } from '@/lib/formatters';
import { PERMISSIONS } from '@/lib/permissions';
import { optionalEmail, optionalNumber, optionalString } from '@/lib/validation';
import type { ResourceFormRendererProps } from '@/components/crud/resource-page';

interface Supplier {
  id: string;
  name: string;
  code?: string;
  company?: string;
  email?: string;
  phone?: string;
  taxId?: string;
  paymentTerms?: number;
  currency?: string;
  openingBalance?: number;
  balance?: number;
  status?: string;
  notes?: string;
  address?: { street?: string; city?: string; country?: string };
}

const schema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(160),
  code: optionalString,
  company: optionalString,
  email: optionalEmail,
  phone: optionalString,
  taxId: optionalString,
  paymentTerms: optionalNumber,
  currency: z.string().length(3).optional(),
  openingBalance: optionalNumber,
  status: z.enum(['active', 'inactive', 'blocked']).optional(),
  notes: optionalString,
  address: z
    .object({ street: optionalString, city: optionalString, country: optionalString })
    .optional(),
});

const baseFields: FormFieldConfig[] = [
  { name: 'name', label: 'Vendor name', required: true, placeholder: 'Global Supplies' },
  { name: 'company', label: 'Company' },
  { name: 'email', label: 'Email', type: 'email', placeholder: 'ap@supplier.com' },
  { name: 'phone', label: 'Phone', type: 'tel' },
  { name: 'code', label: 'Vendor code', hint: 'Leave blank to auto-generate' },
  { name: 'taxId', label: 'Tax ID' },
  { name: 'paymentTerms', label: 'Payment terms (days)', type: 'number', min: 0, max: 365 },
  {
    name: 'currency',
    label: 'Currency',
    type: 'select',
    options: ['USD', 'EUR', 'GBP', 'AED', 'CAD', 'AUD'].map((value) => ({ value, label: value })),
  },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    options: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' },
      { value: 'blocked', label: 'Blocked' },
    ],
  },
  { name: 'address.street', label: 'Street', colSpan: 2 },
  { name: 'address.city', label: 'City' },
  { name: 'address.country', label: 'Country' },
  { name: 'notes', label: 'Notes', type: 'textarea', colSpan: 2 },
];

export default function SuppliersPage() {
  const { can, activeOrganization } = useAuth();
  const currency = activeOrganization?.settings?.currency || 'USD';

  return (
    <ResourcePage<Supplier>
      title="Vendors"
      description="Suppliers, payment terms and outstanding balances."
      endpoint="/suppliers"
      createLabel="New vendor"
      searchPlaceholder="Search vendors…"
      canCreate={can(PERMISSIONS.SUPPLIERS_WRITE)}
      canEdit={can(PERMISSIONS.SUPPLIERS_WRITE)}
      canDelete={can(PERMISSIONS.SUPPLIERS_DELETE)}
      emptyDescription="Add vendors to raise purchase orders and record bills."
      deleteDescription={(supplier) => `${supplier.name} will be removed. Vendors with a balance cannot be deleted.`}
      columns={[
        {
          key: 'name',
          header: 'Vendor',
          cell: (supplier) => (
            <div>
              <p className="font-medium">{supplier.name}</p>
              <p className="text-[11px] text-muted-foreground">{supplier.company || supplier.code || '—'}</p>
            </div>
          ),
        },
        { key: 'contact', header: 'Contact', cell: (supplier) => (
          <div>
            <p>{supplier.email || '—'}</p>
            <p className="text-[11px] text-muted-foreground">{supplier.phone || ''}</p>
          </div>
        ) },
        { key: 'terms', header: 'Terms', cell: (supplier) => `${supplier.paymentTerms ?? 30} days` },
        { key: 'balance', header: 'Balance', align: 'right', cell: (supplier) => formatCurrency(supplier.balance ?? 0, currency) },
        { key: 'status', header: 'Status', cell: (supplier) => <StatusBadge status={supplier.status} /> },
      ]}
      renderForm={({ record, open, onOpenChange }: ResourceFormRendererProps<Supplier>) => (
        <SupplierDialog record={record} open={open} onOpenChange={onOpenChange} defaultCurrency={currency} />
      )}
    />
  );
}

function SupplierDialog({
  record,
  open,
  onOpenChange,
  defaultCurrency,
}: {
  record: Supplier | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCurrency: string;
}) {
  const { save } = useSaveResource('/suppliers', record?.id);
  const fields = record ? baseFields.filter((field) => field.name !== 'openingBalance') : baseFields;

  return (
    <ResourceDialog
      open={open}
      onOpenChange={onOpenChange}
      title={record ? 'Edit vendor' : 'New vendor'}
      description="Vendors can be selected on purchase orders and bills."
      schema={schema}
      fields={fields}
      record={{ status: 'active', currency: defaultCurrency, paymentTerms: 30, ...record }}
      submitLabel={record ? 'Save changes' : 'Create vendor'}
      onSubmit={async (values) => {
        await save(values);
      }}
    />
  );
}
