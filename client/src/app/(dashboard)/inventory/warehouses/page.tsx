'use client';

import { z } from 'zod';
import { ResourcePage } from '@/components/crud/resource-page';
import { ResourceDialog, type FormFieldConfig } from '@/components/crud/resource-dialog';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/use-auth';
import { useSaveResource } from '@/hooks/use-save-resource';
import { PERMISSIONS } from '@/lib/permissions';
import { optionalString } from '@/lib/validation';
import type { ResourceFormRendererProps } from '@/components/crud/resource-page';

interface Warehouse {
  id: string;
  name: string;
  code: string;
  manager?: string;
  phone?: string;
  isDefault?: boolean;
  isActive?: boolean;
  address?: { street?: string; city?: string; state?: string; country?: string; postalCode?: string };
}

const schema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  code: z.string().trim().min(1, 'Code is required').max(20),
  manager: optionalString,
  phone: optionalString,
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  address: z
    .object({
      street: optionalString,
      city: optionalString,
      state: optionalString,
      country: optionalString,
      postalCode: optionalString,
    })
    .optional(),
});

const FIELDS: FormFieldConfig[] = [
  { name: 'name', label: 'Warehouse name', required: true, placeholder: 'Main warehouse' },
  { name: 'code', label: 'Code', required: true, placeholder: 'MAIN' },
  { name: 'manager', label: 'Manager' },
  { name: 'phone', label: 'Phone', type: 'tel' },
  { name: 'isDefault', label: 'Default warehouse', type: 'switch' },
  { name: 'isActive', label: 'Active', type: 'switch' },
  { name: 'address.street', label: 'Street', colSpan: 2 },
  { name: 'address.city', label: 'City' },
  { name: 'address.state', label: 'State / region' },
  { name: 'address.country', label: 'Country' },
  { name: 'address.postalCode', label: 'Postal code' },
];

export default function WarehousesPage() {
  const { can } = useAuth();

  return (
    <ResourcePage<Warehouse>
      title="Warehouses"
      description="Locations that hold stock, with one default receiving location."
      endpoint="/warehouses"
      createLabel="New warehouse"
      searchPlaceholder="Search warehouses…"
      canCreate={can(PERMISSIONS.WAREHOUSES_WRITE)}
      canEdit={can(PERMISSIONS.WAREHOUSES_WRITE)}
      canDelete={can(PERMISSIONS.WAREHOUSES_DELETE)}
      emptyDescription="Add a warehouse to start tracking stock by location."
      deleteDescription={(warehouse) => `${warehouse.name} will be removed. The default warehouse cannot be deleted.`}
      columns={[
        {
          key: 'name',
          header: 'Warehouse',
          cell: (warehouse) => (
            <div>
              <p className="font-medium">{warehouse.name}</p>
              <p className="text-[11px] text-muted-foreground">{warehouse.code}</p>
            </div>
          ),
        },
        { key: 'manager', header: 'Manager', cell: (warehouse) => warehouse.manager || '—' },
        { key: 'city', header: 'Location', cell: (warehouse) => <span className="text-muted-foreground">{[warehouse.address?.city, warehouse.address?.country].filter(Boolean).join(', ') || '—'}</span> },
        { key: 'default', header: 'Default', cell: (warehouse) => (warehouse.isDefault ? <Badge variant="info">Default</Badge> : <span className="text-muted-foreground">—</span>) },
        { key: 'status', header: 'Status', cell: (warehouse) => <StatusBadge status={warehouse.isActive === false ? 'inactive' : 'active'} /> },
      ]}
      renderForm={({ record, open, onOpenChange }: ResourceFormRendererProps<Warehouse>) => (
        <WarehouseDialog record={record} open={open} onOpenChange={onOpenChange} />
      )}
    />
  );
}

function WarehouseDialog({
  record,
  open,
  onOpenChange,
}: {
  record: Warehouse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { save } = useSaveResource('/warehouses', record?.id);

  return (
    <ResourceDialog
      open={open}
      onOpenChange={onOpenChange}
      title={record ? 'Edit warehouse' : 'New warehouse'}
      description="Setting a default warehouse replaces the previous default."
      schema={schema}
      fields={FIELDS}
      record={{ isActive: true, isDefault: false, ...record }}
      submitLabel={record ? 'Save changes' : 'Create warehouse'}
      onSubmit={async (values) => {
        await save(values);
      }}
    />
  );
}
