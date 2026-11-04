'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownLeft, ArrowUpRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/data/data-table';
import { Pagination } from '@/components/data/pagination';
import { SearchInput } from '@/components/data/search-input';
import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { RowActions, type RowActionItem } from '@/components/data/row-actions';
import { PageHeader } from '@/components/layout/page-header';
import { useDebounce } from '@/hooks/use-debounce';
import { useAuth } from '@/hooks/use-auth';
import { notifyError, notifySuccess } from '@/hooks/use-resource';
import { api, buildQuery } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { PERMISSIONS } from '@/lib/permissions';
import { refName } from '@/lib/utils';
import type { PaginationMeta } from '@/lib/types';
import type { TransactionListMeta, TransactionRecord } from '@/lib/schemas/transaction';
import { CreateTransactionDialog, EditTransactionDialog, MetricCard } from '@/components/finance/transaction-dialogs';

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
          meta={meta as PaginationMeta | null}
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
