'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Ban, BookText, Eye, Plus, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/badge';
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
import { notifyError, notifySuccess, useResourceOptions } from '@/hooks/use-resource';
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

interface JournalLine {
  id?: string;
  account?: AccountRef | string;
  description?: string;
  debit: number;
  credit: number;
}

interface JournalRecord {
  id: string;
  number: string;
  date: string;
  description: string;
  referenceNumber?: string;
  status: 'draft' | 'posted' | 'void';
  source: string;
  totalDebit: number;
  totalCredit: number;
  lines: JournalLine[];
  createdBy?: { id?: string; name?: string } | string;
  createdAt?: string;
}

const lineSchema = z
  .object({
    account: z.string().min(1, 'Select an account'),
    description: z.string().max(500).optional(),
    debit: z.string().optional(),
    credit: z.string().optional(),
  })
  .superRefine((line, ctx) => {
    const debit = Number(line.debit || 0);
    const credit = Number(line.credit || 0);
    if (debit < 0) ctx.addIssue({ code: 'custom', path: ['debit'], message: 'Cannot be negative' });
    if (credit < 0) ctx.addIssue({ code: 'custom', path: ['credit'], message: 'Cannot be negative' });
    if (debit === 0 && credit === 0) {
      ctx.addIssue({ code: 'custom', path: ['debit'], message: 'Enter a debit or credit' });
    }
  });

const journalSchema = z
  .object({
    date: z.string().min(1, 'Choose a date'),
    description: z.string().trim().min(2, 'Describe the entry').max(500),
    referenceNumber: z.string().max(120).optional(),
    lines: z.array(lineSchema).min(2, 'A journal entry needs at least two lines'),
  })
  .superRefine((values, ctx) => {
    const debit = values.lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
    const credit = values.lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
    if (Math.abs(debit - credit) > 0.005) {
      ctx.addIssue({
        code: 'custom',
        path: ['lines'],
        message: `Debits and credits must balance (${debit.toFixed(2)} vs ${credit.toFixed(2)})`,
      });
    }
  });

type JournalValues = z.infer<typeof journalSchema>;

const EMPTY_LINE = { account: '', description: '', debit: '', credit: '' };

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

function JournalDetailDialog({
  entry,
  currency,
  onOpenChange,
}: {
  entry: JournalRecord | null;
  currency: string;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={Boolean(entry)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookText className="size-4 text-muted-foreground" />
            {entry?.number}
          </DialogTitle>
          <DialogDescription>
            {entry?.description} · {formatDate(entry?.date)}
          </DialogDescription>
        </DialogHeader>

        {entry && (
          <>
            <div className="grid gap-3 rounded-lg border border-border/80 bg-muted/30 p-3 text-xs sm:grid-cols-4">
              <Detail label="Status" value={<StatusBadge status={entry.status} />} />
              <Detail label="Source" value={<StatusBadge status={entry.source} />} />
              <Detail label="Reference" value={entry.referenceNumber || '—'} />
              <Detail label="Created by" value={refName(entry.createdBy)} />
            </div>

            <div className="overflow-hidden rounded-lg border border-border/80">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Account</th>
                    <th className="px-3 py-2 text-left font-medium">Description</th>
                    <th className="px-3 py-2 text-right font-medium">Debit</th>
                    <th className="px-3 py-2 text-right font-medium">Credit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {entry.lines.map((line, index) => (
                    <tr key={line.id ?? index}>
                      <td className="px-3 py-2">{refName(line.account)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{line.description || '—'}</td>
                      <td className="px-3 py-2 text-right">
                        {line.debit ? formatCurrency(line.debit, currency) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {line.credit ? formatCurrency(line.credit, currency) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-border bg-muted/30 font-medium">
                  <tr>
                    <td className="px-3 py-2" colSpan={2}>
                      Totals
                    </td>
                    <td className="px-3 py-2 text-right">{formatCurrency(entry.totalDebit, currency)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(entry.totalCredit, currency)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-0.5 font-medium">{value}</div>
    </div>
  );
}

function CreateJournalDialog({
  open,
  onOpenChange,
  onSaved,
  currency,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
  currency: string;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const accounts = useResourceOptions<AccountRef>('/accounts', { limit: 100, sort: 'code' });
  const form = useForm<JournalValues>({
    resolver: zodResolver(journalSchema),
    defaultValues: {
      date: toDateInput(new Date()),
      description: '',
      referenceNumber: '',
      lines: [{ ...EMPTY_LINE }, { ...EMPTY_LINE }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' });

  useEffect(() => {
    if (open) {
      form.reset({
        date: toDateInput(new Date()),
        description: '',
        referenceNumber: '',
        lines: [{ ...EMPTY_LINE }, { ...EMPTY_LINE }],
      });
      setServerError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const lines = form.watch('lines');
  const debitTotal = lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
  const creditTotal = lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
  const balanced = Math.abs(debitTotal - creditTotal) < 0.005;

  const submit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      await api.post('/journal-entries', {
        date: values.date,
        description: values.description,
        referenceNumber: values.referenceNumber || undefined,
        lines: values.lines.map((line) => ({
          account: line.account,
          description: line.description || undefined,
          debit: Number(line.debit || 0),
          credit: Number(line.credit || 0),
        })),
      });
      notifySuccess('Journal entry posted');
      await onSaved();
      onOpenChange(false);
    } catch (error) {
      setServerError(
        error instanceof ApiRequestError ? error.message : 'Unable to post the journal entry.',
      );
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle>New journal entry</DialogTitle>
          <DialogDescription>
            Manual entries must balance. Debits increase assets and expenses; credits increase liabilities,
            equity and income.
          </DialogDescription>
        </DialogHeader>

        {serverError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-xs font-medium text-destructive">
            {serverError}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Date" htmlFor="journal-date" required error={form.formState.errors.date?.message}>
              <Input id="journal-date" type="date" {...form.register('date')} />
            </FormField>
            <FormField
              label="Reference"
              htmlFor="journal-reference"
              error={form.formState.errors.referenceNumber?.message}
            >
              <Input id="journal-reference" {...form.register('referenceNumber')} />
            </FormField>
            <FormField
              label="Description"
              htmlFor="journal-description"
              required
              error={form.formState.errors.description?.message}
            >
              <Input id="journal-description" {...form.register('description')} />
            </FormField>
          </div>

          <div className="space-y-2">
            <div className="hidden grid-cols-[1.4fr_1.6fr_0.7fr_0.7fr_2rem] gap-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:grid">
              <span>Account</span>
              <span>Description</span>
              <span className="text-right">Debit</span>
              <span className="text-right">Credit</span>
              <span />
            </div>
            {fields.map((field, index) => {
              const lineError = form.formState.errors.lines?.[index];
              return (
                <div key={field.id} className="rounded-lg border border-border/70 p-2">
                  <div className="grid gap-2 sm:grid-cols-[1.4fr_1.6fr_0.7fr_0.7fr_2rem] sm:items-start">
                    <FormField error={lineError?.account?.message}>
                      <Select {...form.register(`lines.${index}.account`)} aria-label="Account">
                        <option value="">Select account…</option>
                        {(accounts.data?.data ?? []).map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.code ? `${account.code} · ` : ''}
                            {account.name}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                    <FormField>
                      <Input
                        {...form.register(`lines.${index}.description`)}
                        placeholder="Line description"
                        aria-label="Line description"
                      />
                    </FormField>
                    <FormField error={lineError?.debit?.message}>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="0.00"
                        className="text-right"
                        {...form.register(`lines.${index}.debit`)}
                        aria-label="Debit"
                      />
                    </FormField>
                    <FormField error={lineError?.credit?.message}>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="0.00"
                        className="text-right"
                        {...form.register(`lines.${index}.credit`)}
                        aria-label="Credit"
                      />
                    </FormField>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="mt-1 text-muted-foreground"
                      onClick={() => remove(index)}
                      disabled={fields.length <= 2}
                      aria-label="Remove line"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              );
            })}
            {typeof form.formState.errors.lines?.message === 'string' && (
              <p className="text-[11px] font-medium text-destructive">
                {form.formState.errors.lines.message}
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ ...EMPTY_LINE })}
            >
              <Plus />
              Add line
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-4 rounded-lg border border-border/80 bg-muted/30 px-3 py-2 text-xs">
            <span>
              Debits <span className="ml-1 font-semibold">{formatCurrency(debitTotal, currency)}</span>
            </span>
            <span>
              Credits <span className="ml-1 font-semibold">{formatCurrency(creditTotal, currency)}</span>
            </span>
            <span className={balanced ? 'font-medium text-emerald-600 dark:text-emerald-400' : 'font-medium text-destructive'}>
              {balanced ? 'Balanced' : `Out by ${formatCurrency(Math.abs(debitTotal - creditTotal), currency)}`}
            </span>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting} disabled={!balanced}>
              Post entry
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
