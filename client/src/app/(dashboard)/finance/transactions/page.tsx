'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ArrowDownLeft, ArrowUpRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/data/data-table';
import { Pagination } from '@/components/data/pagination';
import { SearchInput } from '@/components/data/search-input';
import { FormField } from '@/components/data/form-field';
import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { RowActions, type RowActionItem } from '@/components/data/row-actions';
import { PageHeader } from '@/components/layout/page-header';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDebounce } from '@/hooks/use-debounce';
import { useAuth } from '@/hooks/use-auth';
import {
  notifyError,
  notifySuccess,
  useResourceOptions,
} from '@/hooks/use-resource';
import { ApiRequestError, api, buildQuery } from '@/lib/api';
import { formatCurrency, formatDate, toDateInput } from '@/lib/formatters';
import { PERMISSIONS } from '@/lib/permissions';
import { refName } from '@/lib/utils';
import type { PaginationMeta } from '@/lib/types';

interface AccountRef {
  id: string;
  name: string;
  code?: string;
  type?: string;
}

interface TransactionRecord {
  id: string;
  number: string;
  type: 'income' | 'expense';
  date: string;
  description: string;
  account?: AccountRef | string;
  paymentAccount?: AccountRef | string;
  amount: number;
  taxAmount: number;
  total: number;
  reference?: string;
  status: 'posted' | 'void';
  createdAt?: string;
}

interface TransactionListMeta extends PaginationMeta {
  summary?: { income: number; expense: number };
}

const createSchema = z.object({
  type: z.enum(['income', 'expense']),
  date: z.string().min(1, 'Choose a date'),
  description: z.string().trim().min(2, 'Describe the transaction').max(500),
  account: z.string().min(1, 'Select a category account'),
  paymentAccount: z.string().min(1, 'Select the bank or cash account'),
  amount: z
    .string()
    .min(1, 'Enter an amount')
    .refine((value) => Number(value) > 0, 'Amount must be greater than zero'),
  taxAmount: z
    .string()
    .optional()
    .refine((value) => !value || Number(value) >= 0, 'Tax cannot be negative'),
  reference: z.string().max(120).optional(),
});

const updateSchema = z.object({
  date: z.string().min(1, 'Choose a date'),
  description: z.string().trim().min(2, 'Describe the transaction').max(500),
  reference: z.string().max(120).optional(),
});

type CreateValues = z.infer<typeof createSchema>;
type UpdateValues = z.infer<typeof updateSchema>;

export default function TransactionsPage() {
  const { can, activeOrganization } = useAuth();
  const currency = activeOrganization?.settings?.currency || 'USD';
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [type, setType] = useState<'' | 'income' | 'expense'>('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<TransactionRecord | null>(null);
  const [deleting, setDeleting] = useState<TransactionRecord | null>(null);
  const debouncedSearch = useDebounce(search, 300);

  const params = {
    page,
    limit,
    search: debouncedSearch || undefined,
    type: type || undefined,
    status: status || undefined,
    from: from || undefined,
    to: to || undefined,
    sort: '-date',
  };

  const query = useQuery({
    queryKey: ['/transactions', 'list', params],
    queryFn: () => api.list<TransactionRecord>(`/transactions${buildQuery(params)}`),
  });

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['/transactions'] }),
      queryClient.invalidateQueries({ queryKey: ['/journal-entries'] }),
      queryClient.invalidateQueries({ queryKey: ['/accounts'] }),
      queryClient.invalidateQueries({ queryKey: ['/reports'] }),
      queryClient.invalidateQueries({ queryKey: ['/dashboard'] }),
    ]);
  };

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/transactions/${id}`),
    onSuccess: async () => {
      notifySuccess('Transaction voided');
      await invalidate();
    },
    onError: (error) => notifyError(error),
  });

  const meta = query.data?.meta as TransactionListMeta | null;
  const summary = meta?.summary ?? { income: 0, expense: 0 };

  const rowActions = (transaction: TransactionRecord): RowActionItem[] => [
    {
      label: 'Edit',
      icon: Pencil,
      disabled: !can(PERMISSIONS.TRANSACTIONS_WRITE) || transaction.status === 'void',
      onSelect: () => setEditing(transaction),
    },
    {
      label: 'Void transaction',
      icon: Trash2,
      destructive: true,
      separatorBefore: true,
      disabled: !can(PERMISSIONS.TRANSACTIONS_DELETE) || transaction.status === 'void',
      onSelect: () => setDeleting(transaction),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Transactions"
        description="Record day-to-day income and expenses. Each entry posts a balanced journal automatically."
        actions={
          <Button onClick={() => setCreating(true)} disabled={!can(PERMISSIONS.TRANSACTIONS_WRITE)}>
            <Plus />
            Record transaction
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Income posted"
          value={formatCurrency(summary.income, currency)}
          tone="positive"
          icon={<ArrowDownLeft className="size-4" />}
        />
        <MetricCard
          label="Expenses posted"
          value={formatCurrency(summary.expense, currency)}
          tone="negative"
          icon={<ArrowUpRight className="size-4" />}
        />
        <MetricCard
          label="Net movement"
          value={formatCurrency(summary.income - summary.expense, currency)}
          icon={<ArrowUpRight className="size-4" />}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border/70 p-4 xl:flex-row xl:items-center xl:justify-between">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Search number, description or reference…"
            className="w-full xl:max-w-xs"
          />
          <div className="flex flex-wrap items-end gap-2">
            <Tabs
              value={type || 'all'}
              onValueChange={(value) => {
                setType(value === 'all' ? '' : (value as 'income' | 'expense'));
                setPage(1);
              }}
            >
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="income">Income</TabsTrigger>
                <TabsTrigger value="expense">Expense</TabsTrigger>
              </TabsList>
            </Tabs>
            <Select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="h-9 w-36"
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              <option value="posted">Posted</option>
              <option value="void">Void</option>
            </Select>
            <Input
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(1);
              }}
              className="w-40"
              aria-label="From date"
            />
            <Input
              type="date"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                setPage(1);
              }}
              className="w-40"
              aria-label="To date"
            />
          </div>
        </div>

        <DataTable<TransactionRecord>
          columns={[
            {
              key: 'number',
              header: 'Transaction',
              cell: (transaction) => (
                <div>
                  <p className="font-medium">{transaction.number}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatDate(transaction.date)}
                    {transaction.reference ? ` · ${transaction.reference}` : ''}
                  </p>
                </div>
              ),
            },
            {
              key: 'description',
              header: 'Description',
              cell: (transaction) => (
                <div>
                  <p>{transaction.description}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {refName(transaction.account)}
                  </p>
                </div>
              ),
            },
            {
              key: 'account',
              header: 'Paid from / into',
              cell: (transaction) => (
                <span className="text-muted-foreground">{refName(transaction.paymentAccount)}</span>
              ),
            },
            {
              key: 'amount',
              header: 'Amount',
              align: 'right',
              cell: (transaction) => (
                <span
                  className={
                    transaction.type === 'income'
                      ? 'font-medium text-emerald-600 dark:text-emerald-400'
                      : 'font-medium text-amber-600 dark:text-amber-400'
                  }
                >
                  {transaction.type === 'income' ? '+' : '−'}
                  {formatCurrency(transaction.total, currency)}
                </span>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              cell: (transaction) => <StatusBadge status={transaction.status} />,
            },
            {
              key: 'actions',
              header: '',
              className: 'w-12 text-right',
              cell: (transaction) => <RowActions items={rowActions(transaction)} />,
            },
          ]}
          rows={query.data?.data ?? []}
          loading={query.isLoading}
          emptyTitle="No transactions recorded"
          emptyDescription="Record income and expenses to keep your books current."
        />

        <Pagination
          meta={meta}
          page={page}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={(value) => {
            setLimit(value);
            setPage(1);
          }}
        />
      </Card>

      <CreateTransactionDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={invalidate}
      />

      <EditTransactionDialog
        key={editing?.id ?? 'edit'}
        record={editing}
        onOpenChange={(open) => !open && setEditing(null)}
        onSaved={invalidate}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Void transaction"
        description={
          deleting
            ? `${deleting.number} will be voided and its journal entry reversed. This cannot be undone.`
            : undefined
        }
        confirmLabel="Void transaction"
        loading={remove.isPending}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await remove.mutateAsync(deleting.id);
            setDeleting(null);
          } catch {
            // Errors are surfaced by the mutation hook.
          }
        }}
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  tone = 'default',
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: 'default' | 'positive' | 'negative';
}) {
  const valueClass =
    tone === 'positive'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'negative'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-foreground';

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <span className="grid size-7 place-items-center rounded-md bg-muted text-muted-foreground">{icon}</span>
      </div>
      <p className={`mt-2 text-2xl font-semibold ${valueClass}`}>{value}</p>
    </Card>
  );
}

function CreateTransactionDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const accounts = useResourceOptions<AccountRef>('/accounts', { limit: 100, sort: 'code' });
  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      type: 'expense',
      date: toDateInput(new Date()),
      description: '',
      account: '',
      paymentAccount: '',
      amount: '',
      taxAmount: '0',
      reference: '',
    },
  });

  const type = form.watch('type');
  const incomeAccounts = (accounts.data?.data ?? []).filter((account) => account.type === 'income');
  const expenseAccounts = (accounts.data?.data ?? []).filter((account) => account.type === 'expense');
  const assetAccounts = (accounts.data?.data ?? []).filter((account) => account.type === 'asset');

  useEffect(() => {
    form.setValue('account', '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  useEffect(() => {
    if (open) {
      form.reset({
        type: 'expense',
        date: toDateInput(new Date()),
        description: '',
        account: '',
        paymentAccount: '',
        amount: '',
        taxAmount: '0',
        reference: '',
      });
      setServerError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      await api.post('/transactions', {
        type: values.type,
        date: values.date,
        description: values.description,
        account: values.account,
        paymentAccount: values.paymentAccount,
        amount: Number(values.amount),
        taxAmount: values.taxAmount ? Number(values.taxAmount) : 0,
        reference: values.reference || undefined,
      });
      notifySuccess('Transaction recorded');
      await onSaved();
      onOpenChange(false);
    } catch (error) {
      setServerError(
        error instanceof ApiRequestError ? error.message : 'Unable to record the transaction.',
      );
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Record transaction</DialogTitle>
          <DialogDescription>
            Income and expense transactions post immediately to the general ledger.
          </DialogDescription>
        </DialogHeader>

        {serverError && <ErrorBanner message={serverError} />}

        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Type" htmlFor="tx-type" required>
              <Select id="tx-type" {...form.register('type')}>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </Select>
            </FormField>
            <FormField label="Date" htmlFor="tx-date" required error={form.formState.errors.date?.message}>
              <Input id="tx-date" type="date" {...form.register('date')} />
            </FormField>
            <FormField
              label="Category account"
              htmlFor="tx-account"
              required
              error={form.formState.errors.account?.message}
              hint={`Only ${type} accounts can be selected.`}
            >
              <Select id="tx-account" {...form.register('account')}>
                <option value="">Select account…</option>
                {(type === 'income' ? incomeAccounts : expenseAccounts).map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.code ? `${account.code} · ` : ''}
                    {account.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField
              label="Bank / cash account"
              htmlFor="tx-payment-account"
              required
              error={form.formState.errors.paymentAccount?.message}
            >
              <Select id="tx-payment-account" {...form.register('paymentAccount')}>
                <option value="">Select account…</option>
                {assetAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.code ? `${account.code} · ` : ''}
                    {account.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField
              label="Amount"
              htmlFor="tx-amount"
              required
              error={form.formState.errors.amount?.message}
            >
              <Input id="tx-amount" type="number" min={0} step="0.01" {...form.register('amount')} />
            </FormField>
            <FormField
              label="Tax amount"
              htmlFor="tx-tax"
              error={form.formState.errors.taxAmount?.message}
              hint="Optional. Added to the total."
            >
              <Input id="tx-tax" type="number" min={0} step="0.01" {...form.register('taxAmount')} />
            </FormField>
            <FormField
              label="Description"
              htmlFor="tx-description"
              required
              colSpan={2}
              error={form.formState.errors.description?.message}
            >
              <Textarea
                id="tx-description"
                rows={2}
                placeholder="What was this transaction for?"
                {...form.register('description')}
              />
            </FormField>
            <FormField
              label="Reference"
              htmlFor="tx-reference"
              colSpan={2}
              error={form.formState.errors.reference?.message}
              hint="Receipt number, bank reference or memo."
            >
              <Input id="tx-reference" {...form.register('reference')} />
            </FormField>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              Record transaction
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditTransactionDialog({
  record,
  onOpenChange,
  onSaved,
}: {
  record: TransactionRecord | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<UpdateValues>({
    resolver: zodResolver(updateSchema),
    defaultValues: {
      date: toDateInput(record?.date),
      description: record?.description ?? '',
      reference: record?.reference ?? '',
    },
  });

  useEffect(() => {
    if (record) {
      form.reset({
        date: toDateInput(record.date),
        description: record.description,
        reference: record.reference ?? '',
      });
      setServerError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record]);

  const submit = form.handleSubmit(async (values) => {
    if (!record) return;
    setServerError(null);
    try {
      await api.patch(`/transactions/${record.id}`, {
        date: values.date,
        description: values.description,
        reference: values.reference || undefined,
      });
      notifySuccess('Transaction updated');
      await onSaved();
      onOpenChange(false);
    } catch (error) {
      setServerError(
        error instanceof ApiRequestError ? error.message : 'Unable to update the transaction.',
      );
    }
  });

  return (
    <Dialog open={Boolean(record)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit transaction</DialogTitle>
          <DialogDescription>
            Amounts and accounts are locked once posted. Only the description, date and reference can change.
          </DialogDescription>
        </DialogHeader>

        {serverError && <ErrorBanner message={serverError} />}

        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Date" htmlFor="tx-edit-date" required error={form.formState.errors.date?.message}>
              <Input id="tx-edit-date" type="date" {...form.register('date')} />
            </FormField>
            <FormField label="Reference" htmlFor="tx-edit-reference">
              <Input id="tx-edit-reference" {...form.register('reference')} />
            </FormField>
            <FormField
              label="Description"
              htmlFor="tx-edit-description"
              required
              colSpan={2}
              error={form.formState.errors.description?.message}
            >
              <Textarea id="tx-edit-description" rows={3} {...form.register('description')} />
            </FormField>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-xs font-medium text-destructive">
      {message}
    </div>
  );
}
