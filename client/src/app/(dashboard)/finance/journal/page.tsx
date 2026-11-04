'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Eye, Plus, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/badge';
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
import type { PaginationMeta } from '@/lib/types';
import type { JournalRecord } from '@/lib/schemas/journal';
import { CreateJournalDialog, JournalDetailDialog } from '@/components/finance/journal-dialogs';

export default function JournalPage() {
  const { can, activeOrganization } = useAuth();
  const currency = activeOrganization?.settings?.currency || 'USD';
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<JournalRecord | null>(null);
  const [voiding, setVoiding] = useState<JournalRecord | null>(null);
  const [deleting, setDeleting] = useState<JournalRecord | null>(null);
  const debouncedSearch = useDebounce(search, 300);

  const params = {
    page,
    limit,
    search: debouncedSearch || undefined,
    status: status || undefined,
    source: source || undefined,
    from: from || undefined,
    to: to || undefined,
    sort: '-date',
  };

  const query = useQuery({
    queryKey: ['/journal-entries', 'list', params],
    queryFn: () => api.list<JournalRecord>(`/journal-entries${buildQuery(params)}`),
  });

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['/journal-entries'] }),
      queryClient.invalidateQueries({ queryKey: ['/accounts'] }),
      queryClient.invalidateQueries({ queryKey: ['/reports'] }),
      queryClient.invalidateQueries({ queryKey: ['/transactions'] }),
      queryClient.invalidateQueries({ queryKey: ['/dashboard'] }),
    ]);
  };

  const voidEntry = useMutation({
    mutationFn: (id: string) => api.post(`/journal-entries/${id}/void`, {}),
    onSuccess: async () => {
      notifySuccess('Journal entry voided');
      await invalidate();
    },
    onError: (error) => notifyError(error),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/journal-entries/${id}`),
    onSuccess: async () => {
      notifySuccess('Journal entry deleted');
      await invalidate();
    },
    onError: (error) => notifyError(error),
  });

  const rowActions = (entry: JournalRecord): RowActionItem[] => [
    { label: 'View entry', icon: Eye, onSelect: () => setViewing(entry) },
    {
      label: 'Void entry',
      icon: Ban,
      separatorBefore: true,
      destructive: true,
      hidden: entry.source !== 'manual' || entry.status !== 'posted',
      disabled: !can(PERMISSIONS.JOURNAL_WRITE),
      onSelect: () => setVoiding(entry),
    },
    {
      label: 'Delete entry',
      icon: Trash2,
      destructive: true,
      hidden: entry.source !== 'manual',
      disabled: !can(PERMISSIONS.JOURNAL_WRITE),
      onSelect: () => setDeleting(entry),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="General journal"
        description="Every automated and manual posting in one immutable ledger. System entries are reversed from their source documents."
        actions={
          <Button onClick={() => setCreating(true)} disabled={!can(PERMISSIONS.JOURNAL_WRITE)}>
            <Plus />
            New journal entry
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border/70 p-4 xl:flex-row xl:items-center xl:justify-between">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Search entry number, description or reference…"
            className="w-full xl:max-w-xs"
          />
          <div className="flex flex-wrap items-end gap-2">
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
            <Select
              value={source}
              onChange={(event) => {
                setSource(event.target.value);
                setPage(1);
              }}
              className="h-9 w-40"
              aria-label="Filter by source"
            >
              <option value="">All sources</option>
              {['manual', 'invoice', 'payment', 'bill', 'expense', 'income', 'payroll', 'opening'].map(
                (value) => (
                  <option key={value} value={value} className="capitalize">
                    {value}
                  </option>
                ),
              )}
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

        <DataTable<JournalRecord>
          columns={[
            {
              key: 'number',
              header: 'Entry',
              cell: (entry) => (
                <div>
                  <p className="font-medium">{entry.number}</p>
                  <p className="text-[11px] text-muted-foreground">{formatDate(entry.date)}</p>
                </div>
              ),
            },
            {
              key: 'description',
              header: 'Description',
              cell: (entry) => (
                <div>
                  <p>{entry.description}</p>
                  {entry.referenceNumber && (
                    <p className="text-[11px] text-muted-foreground">Ref {entry.referenceNumber}</p>
                  )}
                </div>
              ),
            },
            {
              key: 'source',
              header: 'Source',
              cell: (entry) => <StatusBadge status={entry.source} />,
            },
            {
              key: 'debit',
              header: 'Debit',
              align: 'right',
              cell: (entry) => formatCurrency(entry.totalDebit, currency),
            },
            {
              key: 'credit',
              header: 'Credit',
              align: 'right',
              cell: (entry) => formatCurrency(entry.totalCredit, currency),
            },
            {
              key: 'status',
              header: 'Status',
              cell: (entry) => <StatusBadge status={entry.status} />,
            },
            {
              key: 'actions',
              header: '',
              className: 'w-12 text-right',
              cell: (entry) => <RowActions items={rowActions(entry)} />,
            },
          ]}
          rows={query.data?.data ?? []}
          loading={query.isLoading}
          emptyTitle="No journal entries"
          emptyDescription="Post an invoice, payment or manual entry to see it here."
        />

        <Pagination
          meta={(query.data?.meta as PaginationMeta | null) ?? null}
          page={page}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={(value) => {
            setLimit(value);
            setPage(1);
          }}
        />
      </Card>

      <CreateJournalDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={invalidate}
        currency={currency}
      />

      <JournalDetailDialog
        entry={viewing}
        currency={currency}
        onOpenChange={(open) => !open && setViewing(null)}
      />

      <ConfirmDialog
        open={Boolean(voiding)}
        onOpenChange={(open) => !open && setVoiding(null)}
        title="Void journal entry"
        description={
          voiding
            ? `${voiding.number} will be reversed with a balancing entry. The original entry stays visible for audit.`
            : undefined
        }
        confirmLabel="Void entry"
        loading={voidEntry.isPending}
        onConfirm={async () => {
          if (!voiding) return;
          try {
            await voidEntry.mutateAsync(voiding.id);
            setVoiding(null);
          } catch {
            // Errors are surfaced by the mutation hook.
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete journal entry"
        description={
          deleting
            ? `${deleting.number} will be voided and removed from the journal. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete entry"
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
