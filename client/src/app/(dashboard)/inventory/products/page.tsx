'use client';

import { z } from 'zod';
import { ResourcePage } from '@/components/crud/resource-page';
import { ResourceDialog, type FormFieldConfig } from '@/components/crud/resource-dialog';
import { StatusBadge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/use-auth';
import { useResourceOptions } from '@/hooks/use-resource';
import { useSaveResource } from '@/hooks/use-save-resource';
import { formatCurrency, formatNumber } from '@/lib/formatters';
import { refName } from '@/lib/utils';
import { PERMISSIONS } from '@/lib/permissions';
import { optionalId, optionalNumber, optionalString } from '@/lib/validation';
import type { ResourceFormRendererProps } from '@/components/crud/resource-page';

interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  description?: string;
  category?: { id: string; name: string } | string | null;
  supplier?: { id: string; name: string } | string | null;
  warehouse?: { id: string; name: string } | string | null;
  type?: string;
  unit?: string;
  costPrice?: number;
  sellingPrice?: number;
  taxRate?: number;
  stock?: number;
  reserved?: number;
  reorderPoint?: number;
  reorderQty?: number;
  trackInventory?: boolean;
  status?: string;
  imageUrl?: string;
}

interface Option {
  id: string;
  name: string;
  code?: string;
}

const schema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(180),
  sku: z.string().trim().min(1, 'SKU is required').max(60),
  barcode: optionalString,
  description: optionalString,
  category: optionalId,
  supplier: optionalId,
  warehouse: optionalId,
  type: z.enum(['goods', 'service']).optional(),
  unit: optionalString,
  costPrice: optionalNumber,
  sellingPrice: optionalNumber,
  taxRate: optionalNumber,
  stock: optionalNumber,
  reorderPoint: optionalNumber,
  reorderQty: optionalNumber,
  trackInventory: z.boolean().optional(),
  status: z.enum(['active', 'inactive', 'discontinued']).optional(),
  imageUrl: optionalString,
});

const baseFields: FormFieldConfig[] = [
  { name: 'name', label: 'Product name', required: true, placeholder: 'Premium widget' },
  { name: 'sku', label: 'SKU', required: true, placeholder: 'SKU-001' },
  { name: 'barcode', label: 'Barcode' },
  { name: 'type', label: 'Type', type: 'select', options: [{ value: 'goods', label: 'Goods' }, { value: 'service', label: 'Service' }] },
  { name: 'category', label: 'Category', type: 'select' },
  { name: 'supplier', label: 'Preferred vendor', type: 'select' },
  { name: 'warehouse', label: 'Default warehouse', type: 'select' },
  { name: 'unit', label: 'Unit of measure', placeholder: 'pcs' },
  { name: 'costPrice', label: 'Cost price', type: 'number', step: '0.01', min: 0 },
  { name: 'sellingPrice', label: 'Selling price', type: 'number', step: '0.01', min: 0 },
  { name: 'taxRate', label: 'Tax rate (%)', type: 'number', step: '0.01', min: 0, max: 100 },
  { name: 'reorderPoint', label: 'Reorder point', type: 'number', min: 0 },
  { name: 'reorderQty', label: 'Reorder quantity', type: 'number', min: 0 },
  { name: 'status', label: 'Status', type: 'select', options: [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'discontinued', label: 'Discontinued' },
  ] },
  { name: 'trackInventory', label: 'Track inventory', type: 'switch' },
  { name: 'imageUrl', label: 'Image URL', colSpan: 2 },
  { name: 'description', label: 'Description', type: 'textarea', colSpan: 2 },
];

export default function ProductsPage() {
  const { can, activeOrganization } = useAuth();
  const currency = activeOrganization?.settings?.currency || 'USD';

  return (
    <ResourcePage<Product>
      title="Products"
      description="Catalogue, pricing and stock policy for every item you sell."
      endpoint="/products"
      createLabel="New product"
      searchPlaceholder="Search by name, SKU or barcode…"
      canCreate={can(PERMISSIONS.PRODUCTS_WRITE)}
      canEdit={can(PERMISSIONS.PRODUCTS_WRITE)}
      canDelete={can(PERMISSIONS.PRODUCTS_DELETE)}
      emptyDescription="Add products so you can quote, sell and track inventory."
      deleteDescription={(product) => `${product.name} will be removed. Products with stock on hand cannot be deleted.`}
      columns={[
        {
          key: 'name',
          header: 'Product',
          cell: (product) => (
            <div>
              <p className="font-medium">{product.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {product.sku} · {refName(product.category)}
              </p>
            </div>
          ),
        },
        { key: 'type', header: 'Type', cell: (product) => <span className="capitalize text-muted-foreground">{product.type ?? 'goods'}</span> },
        { key: 'stock', header: 'Stock', align: 'right', cell: (product) => (
          <div>
            <p className="font-medium">{formatNumber(product.stock ?? 0)} {product.unit ?? 'pcs'}</p>
            {(product.reserved ?? 0) > 0 && <p className="text-[11px] text-muted-foreground">{formatNumber(product.reserved)} reserved</p>}
          </div>
        ) },
        { key: 'reorder', header: 'Reorder at', align: 'right', cell: (product) => formatNumber(product.reorderPoint ?? 0) },
        { key: 'cost', header: 'Cost', align: 'right', cell: (product) => formatCurrency(product.costPrice ?? 0, currency) },
        { key: 'price', header: 'Price', align: 'right', cell: (product) => <span className="font-medium">{formatCurrency(product.sellingPrice ?? 0, currency)}</span> },
        { key: 'status', header: 'Status', cell: (product) => <StatusBadge status={product.status} /> },
      ]}
      renderForm={({ record, open, onOpenChange }: ResourceFormRendererProps<Product>) => (
        <ProductDialog record={record} open={open} onOpenChange={onOpenChange} />
      )}
    />
  );
}

function ProductDialog({
  record,
  open,
  onOpenChange,
}: {
  record: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { save } = useSaveResource('/products', record?.id);
  const categories = useResourceOptions<Option>('/categories', { limit: 100 });
  const suppliers = useResourceOptions<Option>('/suppliers', { limit: 100 });
  const warehouses = useResourceOptions<Option>('/warehouses', { limit: 100 });

  const toOptions = (items: Option[] | undefined) =>
    (items ?? []).map((item) => ({ value: item.id, label: item.code ? `${item.name} (${item.code})` : item.name }));

  const fields: FormFieldConfig[] = baseFields.map((field) => {
    if (field.name === 'category') return { ...field, options: toOptions(categories.data?.data) };
    if (field.name === 'supplier') return { ...field, options: toOptions(suppliers.data?.data) };
    if (field.name === 'warehouse') return { ...field, options: toOptions(warehouses.data?.data) };
    if (field.name === 'sku' && record) return { ...field, disabled: true, hint: 'SKU cannot be changed after creation' };
    return field;
  });

  if (!record) {
    fields.splice(12, 0, { name: 'stock', label: 'Opening stock', type: 'number', min: 0, hint: 'Creates an opening stock movement' });
  }

  return (
    <ResourceDialog
      open={open}
      onOpenChange={onOpenChange}
      title={record ? 'Edit product' : 'New product'}
      description="Prices and stock are validated against your workspace settings."
      schema={schema}
      fields={fields}
      record={{
        type: 'goods',
        status: 'active',
        unit: 'pcs',
        trackInventory: true,
        taxRate: 0,
        costPrice: 0,
        sellingPrice: 0,
        reorderPoint: 0,
        reorderQty: 0,
        ...record,
      }}
      submitLabel={record ? 'Save changes' : 'Create product'}
      wide
      onSubmit={async (values) => {
        const payload = { ...values };
        if (record) delete payload.stock;
        await save(payload);
      }}
    />
  );
}
