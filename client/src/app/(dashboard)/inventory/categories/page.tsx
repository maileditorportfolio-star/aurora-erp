'use client';

import { z } from 'zod';
import { ResourcePage } from '@/components/crud/resource-page';
import { ResourceDialog, type FormFieldConfig } from '@/components/crud/resource-dialog';
import { StatusBadge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/use-auth';
import { useResourceOptions } from '@/hooks/use-resource';
import { useSaveResource } from '@/hooks/use-save-resource';
import { PERMISSIONS } from '@/lib/permissions';
import { optionalId, optionalString } from '@/lib/validation';
import type { ResourceFormRendererProps } from '@/components/crud/resource-page';

interface Category {
  id: string;
  name: string;
  code?: string;
  description?: string;
  color?: string;
  isActive?: boolean;
  parent?: { id: string; name: string } | string | null;
}

const schema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  code: optionalString,
  description: optionalString,
  parent: optionalId,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour like #6366f1').optional(),
  isActive: z.boolean().optional(),
});

const baseFields: FormFieldConfig[] = [
  { name: 'name', label: 'Category name', required: true, placeholder: 'Electronics' },
  { name: 'code', label: 'Code', placeholder: 'ELEC' },
  { name: 'parent', label: 'Parent category', type: 'select' },
  { name: 'color', label: 'Colour', type: 'color' },
  { name: 'isActive', label: 'Active', type: 'switch' },
  { name: 'description', label: 'Description', type: 'textarea', colSpan: 2 },
];

export default function CategoriesPage() {
  const { can } = useAuth();

  return (
    <ResourcePage<Category>
      title="Categories"
      description="Group products for reporting, pricing rules and a clean catalogue."
      endpoint="/categories"
      createLabel="New category"
      searchPlaceholder="Search categories…"
      canCreate={can(PERMISSIONS.CATEGORIES_WRITE)}
      canEdit={can(PERMISSIONS.CATEGORIES_WRITE)}
      canDelete={can(PERMISSIONS.CATEGORIES_DELETE)}
      emptyDescription="Create categories to organise your product catalogue."
      deleteDescription={(category) => `${category.name} will be removed. Categories with products cannot be deleted.`}
      columns={[
        {
          key: 'name',
          header: 'Category',
          cell: (category) => (
            <div className="flex items-center gap-2.5">
              <span className="size-2.5 rounded-full" style={{ background: category.color || '#6366f1' }} />
              <div>
                <p className="font-medium">{category.name}</p>
                <p className="text-[11px] text-muted-foreground">{category.code || '—'}</p>
              </div>
            </div>
          ),
        },
        { key: 'description', header: 'Description', cell: (category) => <span className="text-muted-foreground">{category.description || '—'}</span> },
        { key: 'active', header: 'Status', cell: (category) => <StatusBadge status={category.isActive === false ? 'inactive' : 'active'} /> },
      ]}
      renderForm={({ record, open, onOpenChange }: ResourceFormRendererProps<Category>) => (
        <CategoryDialog record={record} open={open} onOpenChange={onOpenChange} />
      )}
    />
  );
}

function CategoryDialog({
  record,
  open,
  onOpenChange,
}: {
  record: Category | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { save } = useSaveResource('/categories', record?.id);
  const categories = useResourceOptions<Category>('/categories', { limit: 100 });

  const fields = baseFields.map((field) =>
    field.name === 'parent'
      ? {
          ...field,
          options: (categories.data?.data ?? [])
            .filter((category) => category.id !== record?.id)
            .map((category) => ({ value: category.id, label: category.name })),
        }
      : field,
  );

  return (
    <ResourceDialog
      open={open}
      onOpenChange={onOpenChange}
      title={record ? 'Edit category' : 'New category'}
      description="Categories power product filtering and sales reporting."
      schema={schema}
      fields={fields}
      record={{ isActive: true, color: '#6366f1', ...record }}
      submitLabel={record ? 'Save changes' : 'Create category'}
      onSubmit={async (values) => {
        await save(values);
      }}
    />
  );
}
