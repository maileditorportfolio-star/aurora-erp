'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ApiRequestError } from '@/lib/api';
import { formatCurrency } from '@/lib/formatters';
import { useAuth } from '@/hooks/use-auth';
import { useResourceOptions } from '@/hooks/use-resource';
import { useSaveResource } from '@/hooks/use-save-resource';
import { notifySuccess } from '@/hooks/use-resource';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/data/form-field';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Option {
  id: string;
  name: string;
  company?: string;
  number?: string;
  balance?: number;
  total?: number;
  status?: string;
  customer?: { id?: string; name?: string } | string;
  supplier?: { id?: string; name?: string } | string;
}

const schema = z
  .object({
    type: z.enum(['receivable', 'payable']),
    customer: z.string().optional(),
    supplier: z.string().optional(),
    invoice: z.string().optional(),
    bill: z.string().optional(),
    amount: z.coerce.number().positive('Amount must be greater than zero'),
    method: z.enum(['cash', 'bank', 'card', 'cheque', 'online', 'other']).optional(),
    reference: z.string().optional(),
    date: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine(
    (value) =>
      value.type === 'receivable'
        ? Boolean(value.invoice || value.customer)
        : Boolean(value.bill || value.supplier),
    { message: 'Select an invoice/bill or a customer/vendor', path: ['invoice'] },
  );

type FormValues = z.infer<typeof schema>;

export function PaymentDialog({
  open,
  onOpenChange,
  defaultType = 'receivable',
  defaultInvoiceId,
  defaultBillId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: 'receivable' | 'payable';
  defaultInvoiceId?: string;
  defaultBillId?: string;
}) {
  const { activeOrganization } = useAuth();
  const currency = activeOrganization?.settings?.currency || 'USD';
  const [serverError, setServerError] = useState<string | null>(null);
  const { save } = useSaveResource('/payments', undefined, ['/dashboard']);
  const customers = useResourceOptions<Option>('/customers', { limit: 100 });
  const suppliers = useResourceOptions<Option>('/suppliers', { limit: 100 });
  const invoices = useResourceOptions<Option>('/invoices', { limit: 100, status: 'sent' });
  const partialInvoices = useResourceOptions<Option>('/invoices', { limit: 100, status: 'partial' });
  const overdueInvoices = useResourceOptions<Option>('/invoices', { limit: 100, status: 'overdue' });
  const bills = useResourceOptions<Option>('/bills', { limit: 100, status: 'open' });
  const partialBills = useResourceOptions<Option>('/bills', { limit: 100, status: 'partial' });
  const overdueBills = useResourceOptions<Option>('/bills', { limit: 100, status: 'overdue' });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema as never),
    defaultValues: {
      type: defaultType,
      amount: 0,
      method: 'bank',
      date: new Date().toISOString().slice(0, 10),
      invoice: defaultInvoiceId ?? '',
      bill: defaultBillId ?? '',
      customer: '',
      supplier: '',
      reference: '',
      notes: '',
    },
  });

  const type = form.watch('type');
  const selectedInvoiceId = form.watch('invoice');
  const selectedBillId = form.watch('bill');

  useEffect(() => {
    if (!open) return;
    form.reset({
      type: defaultType,
      amount: 0,
      method: 'bank',
      date: new Date().toISOString().slice(0, 10),
      invoice: defaultInvoiceId ?? '',
      bill: defaultBillId ?? '',
      customer: '',
      supplier: '',
      reference: '',
      notes: '',
    });
    setServerError(null);
  }, [open, defaultType, defaultInvoiceId, defaultBillId, form]);

  const receivableInvoices = [
    ...(invoices.data?.data ?? []),
    ...(partialInvoices.data?.data ?? []),
    ...(overdueInvoices.data?.data ?? []),
  ].filter((invoice, index, list) => list.findIndex((entry) => entry.id === invoice.id) === index);

  const payableBills = [
    ...(bills.data?.data ?? []),
    ...(partialBills.data?.data ?? []),
    ...(overdueBills.data?.data ?? []),
  ].filter((bill, index, list) => list.findIndex((entry) => entry.id === bill.id) === index);

  useEffect(() => {
    if (selectedInvoiceId) {
      const invoice = receivableInvoices.find((entry) => entry.id === selectedInvoiceId);
      if (invoice?.balance) form.setValue('amount', invoice.balance);
      if (invoice?.customer) {
        form.setValue('customer', typeof invoice.customer === 'string' ? invoice.customer : invoice.customer.id ?? '');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInvoiceId]);

  useEffect(() => {
    if (selectedBillId) {
      const bill = payableBills.find((entry) => entry.id === selectedBillId);
      if (bill?.balance) form.setValue('amount', bill.balance);
      if (bill?.supplier) {
        form.setValue('supplier', typeof bill.supplier === 'string' ? bill.supplier : bill.supplier.id ?? '');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBillId]);

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      await save({
        type: values.type,
        customer: values.type === 'receivable' ? values.customer || undefined : undefined,
        supplier: values.type === 'payable' ? values.supplier || undefined : undefined,
        invoice: values.type === 'receivable' ? values.invoice || undefined : undefined,
        bill: values.type === 'payable' ? values.bill || undefined : undefined,
        amount: values.amount,
        method: values.method,
        reference: values.reference || undefined,
        date: values.date || undefined,
        notes: values.notes || undefined,
      });
      notifySuccess('Payment recorded');
      onOpenChange(false);
    } catch (error) {
      setServerError(error instanceof ApiRequestError ? error.message : 'Unable to record payment.');
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>
            Receivables update the invoice balance and customer ledger automatically.
          </DialogDescription>
        </DialogHeader>

        {serverError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-xs font-medium text-destructive">
            {serverError}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Payment type" htmlFor="payment-type" required>
              <Select
                id="payment-type"
                {...form.register('type')}
                onChange={(event) => {
                  form.setValue('type', event.target.value as 'receivable' | 'payable');
                  form.setValue('invoice', '');
                  form.setValue('bill', '');
                }}
              >
                <option value="receivable">Customer receipt</option>
                <option value="payable">Vendor payment</option>
              </Select>
            </FormField>

            <FormField label="Date" htmlFor="payment-date">
              <Input id="payment-date" type="date" {...form.register('date')} />
            </FormField>

            {type === 'receivable' ? (
              <>
                <FormField label="Invoice" htmlFor="payment-invoice" error={form.formState.errors.invoice?.message}>
                  <Select id="payment-invoice" {...form.register('invoice')}>
                    <option value="">No specific invoice</option>
                    {receivableInvoices.map((invoice) => (
                      <option key={invoice.id} value={invoice.id}>
                        {invoice.number} · balance {formatCurrency(invoice.balance ?? 0, currency)}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Customer" htmlFor="payment-customer">
                  <Select id="payment-customer" {...form.register('customer')}>
                    <option value="">Select customer…</option>
                    {(customers.data?.data ?? []).map((customer) => (
                      <option key={customer.id} value={customer.id}>{customer.name}</option>
                    ))}
                  </Select>
                </FormField>
              </>
            ) : (
              <>
                <FormField label="Vendor bill" htmlFor="payment-bill" error={form.formState.errors.invoice?.message}>
                  <Select id="payment-bill" {...form.register('bill')}>
                    <option value="">No specific bill</option>
                    {payableBills.map((bill) => (
                      <option key={bill.id} value={bill.id}>
                        {bill.number} · balance {formatCurrency(bill.balance ?? 0, currency)}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Vendor" htmlFor="payment-supplier">
                  <Select id="payment-supplier" {...form.register('supplier')}>
                    <option value="">Select vendor…</option>
                    {(suppliers.data?.data ?? []).map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                    ))}
                  </Select>
                </FormField>
              </>
            )}

            <FormField label="Amount" htmlFor="payment-amount" required error={form.formState.errors.amount?.message}>
              <Input id="payment-amount" type="number" step="0.01" min={0} {...form.register('amount')} />
            </FormField>

            <FormField label="Method" htmlFor="payment-method">
              <Select id="payment-method" {...form.register('method')}>
                {['cash', 'bank', 'card', 'cheque', 'online', 'other'].map((method) => (
                  <option key={method} value={method} className="capitalize">{method}</option>
                ))}
              </Select>
            </FormField>

            <FormField label="Reference" htmlFor="payment-reference">
              <Input id="payment-reference" placeholder="Transaction or cheque number" {...form.register('reference')} />
            </FormField>
          </div>

          <FormField label="Notes" htmlFor="payment-notes">
            <Textarea id="payment-notes" rows={2} {...form.register('notes')} />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={form.formState.isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              Record payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
