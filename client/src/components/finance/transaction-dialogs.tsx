'use client';
import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { FormField } from '@/components/data/form-field';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { notifySuccess, useResourceOptions } from '@/hooks/use-resource';
import { ApiRequestError, api } from '@/lib/api';
import { toDateInput } from '@/lib/formatters';
import { createSchema, updateSchema, type AccountRef, type CreateValues, type TransactionRecord, type UpdateValues } from '@/lib/schemas/transaction';
export function MetricCard({
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

export function CreateTransactionDialog({
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

export function EditTransactionDialog({
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

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-xs font-medium text-destructive">
      {message}
    </div>
  );
}
