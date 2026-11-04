'use client';

import { z } from 'zod';
import { ResourcePage } from '@/components/crud/resource-page';
import { ResourceDialog, type FormFieldConfig } from '@/components/crud/resource-dialog';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/use-auth';
import { useResourceOptions } from '@/hooks/use-resource';
import { useSaveResource } from '@/hooks/use-save-resource';
import { formatCurrency, humanize } from '@/lib/formatters';
import { refName } from '@/lib/utils';
import { PERMISSIONS } from '@/lib/permissions';
import { optionalId, optionalString } from '@/lib/validation';
import type { ResourceFormRendererProps } from '@/components/crud/resource-page';

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
  subtype?: string;
  normalBalance?: string;
  balance?: number;
  isGroup?: boolean;
  isActive?: boolean;
  isSystem?: boolean;
  description?: string;
  parent?: { id: string; name: string } | string | null;
}

const schema = z.object({
  code: z.string().trim().min(1, 'Code is required').max(20),
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(160),
  type: z.enum(['asset', 'liability', 'equity', 'income', 'expense']),
  subtype: optionalString,
  parent: optionalId,
  isGroup: z.boolean().optional(),
  normalBalance: z.enum(['debit', 'credit']),
  description: optionalString,
  isActive: z.boolean().optional(),
});

const FIELDS: FormFieldConfig[] = [
  { name: 'code', label: 'Account code', required: true, placeholder: '1000' },
  { name: 'name', label: 'Account name', required: true, placeholder: 'Cash on hand' },
  {
    name: 'type',
    label: 'Account type',
    type: 'select',
    required: true,
    options: [
      { value: 'asset', label: 'Asset' },
      { value: 'liability', label: 'Liability' },
      { value: 'equity', label: 'Equity' },
      { value: 'income', label: 'Income' },
      { value: 'expense', label: 'Expense' },
    ],
  },
  {
    name: 'normalBalance',
    label: 'Normal balance',
    type: 'select',
    required: true,
    options: [
      { value: 'debit', label: 'Debit' },
      { value: 'credit', label: 'Credit' },
    ],
  },
  { name: 'subtype', label: 'Subtype', placeholder: 'cost_of_sales' },
  { name: 'parent', label: 'Parent account', type: 'select' },
  { name: 'isGroup', label: 'Group account', type: 'switch' },
  { name: 'isActive', label: 'Active', type: 'switch' },
  { name: 'description', label: 'Description', type: 'textarea', colSpan: 2 },
];

export default function AccountsPage() {
  const { can, activeOrganization } = useAuth();
  const currency = activeOrganization?.settings?.currency || 'USD';

  return (
    <ResourcePage<Account>
      title="Chart of accounts"
      description="The ledger structure behind every journal entry and financial report."
      endpoint="/accounts"
      createLabel="New account"
      searchPlaceholder="Search accounts…"
      canCreate={can(PERMISSIONS.ACCOUNTS_WRITE)}
      canEdit={can(PERMISSIONS.ACCOUNTS_WRITE)}
      canDelete={can(PERMISSIONS.ACCOUNTS_DELETE)}
      emptyDescription="Accounts are created automatically for new workspaces."
      deleteDescription={(account) => `${account.code} ${account.name} will be removed. System accounts and accounts with ledger entries are protected.`}
      columns={[
        {
          key: 'account',
          header: 'Account',
          cell: (account) => (
            <div>
              <p className="font-medium">{account.code} · {account.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {humanize(account.type)}{account.subtype ? ` · ${humanize(account.subtype)}` : ''}
              </p>
            </div>
          ),
        },
        { key: 'parent', header: 'Parent', cell: (account) => <span className="text-muted-foreground">{refName(account.parent)}</span> },
        { key: 'normal', header: 'Normal balance', cell: (account) => <Badge variant="outline" className="capitalize">{account.normalBalance ?? 'debit'}</Badge> },
        { key: 'balance', header: 'Balance', align: 'right', cell: (account) => <span className="font-medium">{formatCurrency(account.balance ?? 0, currency)}</span> },
        { key: 'status', header: 'Status', cell: (account) => (
          <div className="flex items-center gap-1.5">
            <StatusBadge status={account.isActive === false ? 'inactive' : 'active'} />
            {account.isSystem && <Badge variant="secondary">System</Badge>}
          </div>
        ) },
      ]}
      renderForm={({ record, open, onOpenChange }: ResourceFormRendererProps<Account>) => (
        <AccountDialog record={record} open={open} onOpenChange={onOpenChange} />
      )}
    />
  );
}

function AccountDialog({
  record,
  open,
  onOpenChange,
}: {
  record: Account | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { save } = useSaveResource('/accounts', record?.id);
  const accounts = useResourceOptions<Account>('/accounts', { limit: 100 });

  const fields = FIELDS.map((field) =>
    field.name === 'parent'
      ? {
          ...field,
          options: (accounts.data?.data ?? [])
            .filter((account) => account.id !== record?.id)
            .map((account) => ({ value: account.id, label: `${account.code} · ${account.name}` })),
        }
      : field,
  );

  return (
    <ResourceDialog
      open={open}
      onOpenChange={onOpenChange}
      title={record ? 'Edit account' : 'New account'}
      description="Balances are derived from posted journal entries and cannot be edited directly."
      schema={schema}
      fields={fields}
      record={{ isActive: true, isGroup: false, normalBalance: 'debit', ...record }}
      submitLabel={record ? 'Save changes' : 'Create account'}
      onSubmit={async (values) => {
        await save(values);
      }}
    />
  );
}
