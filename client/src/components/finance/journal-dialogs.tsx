'use client';
import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFieldArray, useForm } from 'react-hook-form';
import { BookText, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/badge';
import { FormField } from '@/components/data/form-field';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { notifySuccess, useResourceOptions } from '@/hooks/use-resource';
import { ApiRequestError, api } from '@/lib/api';
import { formatCurrency, formatDate, toDateInput } from '@/lib/formatters';
import { refName } from '@/lib/utils';
import { EMPTY_LINE, journalSchema, type AccountRef, type JournalRecord, type JournalValues } from '@/lib/schemas/journal';
export function JournalDetailDialog({
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

export function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-0.5 font-medium">{value}</div>
    </div>
  );
}

export function CreateJournalDialog({
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
