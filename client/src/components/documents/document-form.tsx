'use client';

import { useEffect, useMemo, useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2 } from 'lucide-react';
import { ApiRequestError } from '@/lib/api';
import { formatCurrency, toDateInput } from '@/lib/formatters';
import { refId } from '@/lib/utils';
import { optionalId, optionalString } from '@/lib/validation';
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
import { cn } from '@/lib/utils';
import type { DocumentRecord } from '@/lib/types';

export type DocumentKind = 'quotation' | 'salesOrder' | 'invoice' | 'purchaseOrder' | 'bill';

export const DOCUMENT_CONFIG: Record<
  DocumentKind,
  { endpoint: string; title: string; party: 'customer' | 'supplier'; priceField: 'unitPrice' | 'unitCost' }
> = {
  quotation: { endpoint: '/quotations', title: 'Quotation', party: 'customer', priceField: 'unitPrice' },
  salesOrder: { endpoint: '/sales-orders', title: 'Sales order', party: 'customer', priceField: 'unitPrice' },
  invoice: { endpoint: '/invoices', title: 'Invoice', party: 'customer', priceField: 'unitPrice' },
  purchaseOrder: { endpoint: '/purchase-orders', title: 'Purchase order', party: 'supplier', priceField: 'unitCost' },
  bill: { endpoint: '/bills', title: 'Vendor bill', party: 'supplier', priceField: 'unitCost' },
};

interface ItemValues {
  product?: string;
  description: string;
  quantity: number | string;
  unitPrice: number | string;
  unitCost: number | string;
  discountRate: number | string;
  taxRate: number | string;
}

export interface DocumentFormValues {
  customer?: string;
  supplier?: string;
  date?: string;
  validUntil?: string;
  deliveryDate?: string;
  expectedDate?: string;
  issueDate?: string;
  dueDate?: string;
  warehouse?: string;
  notes?: string;
  terms?: string;
  items: ItemValues[];
}

interface Option {
  id: string;
  name: string;
  company?: string;
  code?: string;
  sellingPrice?: number;
  costPrice?: number;
  taxRate?: number;
  unit?: string;
  sku?: string;
}

const lineSchema = z.object({
  product: optionalId,
  description: z.string().trim().min(1, 'Describe this line').max(500),
  quantity: z.coerce.number().positive('Quantity must be greater than zero'),
  unitPrice: z.coerce.number().min(0),
  unitCost: z.coerce.number().min(0),
  discountRate: z.coerce.number().min(0).max(100),
  taxRate: z.coerce.number().min(0).max(100),
});

function buildSchema(kind: DocumentKind) {
  const party = DOCUMENT_CONFIG[kind].party;
  const base: Record<string, z.ZodType> = {
    date: optionalString,
    issueDate: optionalString,
    notes: optionalString,
    warehouse: optionalId,
    items: z.array(lineSchema).min(1, 'Add at least one line item'),
  };
  if (party === 'customer') base.customer = z.string().min(1, 'Select a customer');
  else base.supplier = z.string().min(1, 'Select a vendor');

  if (kind === 'quotation') {
    base.validUntil = z.string().min(1, 'Valid-until date is required');
    base.terms = optionalString;
  }
  if (kind === 'salesOrder') base.deliveryDate = optionalString;
  if (kind === 'invoice') base.dueDate = optionalString;
  if (kind === 'purchaseOrder') {
    base.expectedDate = optionalString;
    base.terms = optionalString;
  }
  if (kind === 'bill') base.dueDate = z.string().min(1, 'Due date is required');

  return z.object(base);
}

function linesFromRecord(record?: DocumentRecord | null): ItemValues[] {
  if (!record?.items?.length) {
    return [{ description: '', quantity: 1, unitPrice: 0, unitCost: 0, discountRate: 0, taxRate: 0 }];
  }
  return record.items.map((item) => ({
    product: refId(item.product),
    description: item.description ?? '',
    quantity: item.quantity ?? 1,
    unitPrice: item.unitPrice ?? 0,
    unitCost: item.unitCost ?? 0,
    discountRate: item.discountRate ?? 0,
    taxRate: item.taxRate ?? 0,
  }));
}

function computeTotals(items: ItemValues[], priceField: 'unitPrice' | 'unitCost') {
  let subtotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;
  for (const item of items) {
    const quantity = Number(item.quantity) || 0;
    const price = Number(item[priceField]) || 0;
    const lineSubtotal = quantity * price;
    const discount = lineSubtotal * ((Number(item.discountRate) || 0) / 100);
    const taxable = lineSubtotal - discount;
    const tax = taxable * ((Number(item.taxRate) || 0) / 100);
    subtotal += lineSubtotal;
    discountTotal += discount;
    taxTotal += tax;
  }
  const total = subtotal - discountTotal + taxTotal;
  return { subtotal, discountTotal, taxTotal, total };
}

export function DocumentFormDialog({
  kind,
  open,
  onOpenChange,
  record,
  initialCustomerId,
  initialSupplierId,
}: {
  kind: DocumentKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record?: DocumentRecord | null;
  initialCustomerId?: string;
  initialSupplierId?: string;
}) {
  const config = DOCUMENT_CONFIG[kind];
  const { activeOrganization } = useAuth();
  const currency = activeOrganization?.settings?.currency || 'USD';
  const { save } = useSaveResource(config.endpoint, record?.id);
  const customers = useResourceOptions<Option>('/customers', { limit: 100 });
  const suppliers = useResourceOptions<Option>('/suppliers', { limit: 100 });
  const warehouses = useResourceOptions<Option>('/warehouses', { limit: 100 });
  const products = useResourceOptions<Option>('/products', { limit: 100 });
  const [serverError, setServerError] = useServerError();

  const defaultValues = useMemo<DocumentFormValues>(() => {
    const partyRef = config.party === 'customer' ? record?.customer : record?.supplier;
    return {
      customer:
        (config.party === 'customer' ? refId(partyRef) ?? initialCustomerId : undefined) ?? '',
      supplier:
        (config.party === 'supplier' ? refId(partyRef) ?? initialSupplierId : undefined) ?? '',
      date: toDateInput(record?.date),
      validUntil: toDateInput(record?.validUntil),
      issueDate: toDateInput(record?.issueDate) || (record ? '' : new Date().toISOString().slice(0, 10)),
      dueDate: toDateInput(record?.dueDate),
      deliveryDate: toDateInput((record as { deliveryDate?: string } | undefined)?.deliveryDate),
      expectedDate: toDateInput((record as { expectedDate?: string } | undefined)?.expectedDate),
      warehouse: refId((record as { warehouse?: unknown } | undefined)?.warehouse) ?? '',
      notes: record?.notes ?? '',
      terms: record?.terms ?? '',
      items: linesFromRecord(record),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record, kind]);

  const form = useForm<DocumentFormValues>({
    resolver: zodResolver(buildSchema(kind) as never),
    defaultValues,
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' });
  const watchedItems = useWatch({ control: form.control, name: 'items' }) ?? defaultValues.items;
  const totals = computeTotals(watchedItems as ItemValues[], config.priceField);
  const isInvoiceEdit = kind === 'invoice' && Boolean(record);
  const isBillEdit = kind === 'bill' && Boolean(record);

  useEffect(() => {
    if (open) {
      form.reset(defaultValues);
      setServerError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultValues]);

  const applyProduct = (index: number, productId: string) => {
    const product = products.data?.data.find((entry) => entry.id === productId);
    if (!product) {
      form.setValue(`items.${index}.product`, productId);
      return;
    }
    form.setValue(`items.${index}.product`, productId);
    form.setValue(`items.${index}.description`, product.name);
    form.setValue(`items.${index}.unitPrice`, product.sellingPrice ?? 0);
    form.setValue(`items.${index}.unitCost`, product.costPrice ?? 0);
    form.setValue(`items.${index}.taxRate`, product.taxRate ?? 0);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    const items = (values.items ?? []).map((item) => ({
      product: item.product || undefined,
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice) || 0,
      unitCost: Number(item.unitCost) || 0,
      discountRate: Number(item.discountRate) || 0,
      taxRate: Number(item.taxRate) || 0,
    }));

    const payload: Record<string, unknown> = { items, notes: values.notes || undefined };
    if (config.party === 'customer') payload.customer = values.customer;
    else payload.supplier = values.supplier;
    if (values.warehouse) payload.warehouse = values.warehouse;

    if (kind === 'quotation') {
      payload.date = values.date || undefined;
      payload.validUntil = values.validUntil;
      payload.terms = values.terms || undefined;
    }
    if (kind === 'salesOrder') {
      payload.date = values.date || undefined;
      payload.deliveryDate = values.deliveryDate || undefined;
    }
    if (kind === 'invoice') {
      payload.issueDate = values.issueDate || undefined;
      payload.dueDate = values.dueDate || undefined;
      payload.terms = values.terms || undefined;
    }
    if (kind === 'purchaseOrder') {
      payload.date = values.date || undefined;
      payload.expectedDate = values.expectedDate || undefined;
      payload.terms = values.terms || undefined;
    }
    if (kind === 'bill') {
      payload.issueDate = values.issueDate || undefined;
      payload.dueDate = values.dueDate;
    }

    try {
      if (isInvoiceEdit) {
        await save({
          dueDate: values.dueDate || undefined,
          notes: values.notes || undefined,
          terms: values.terms || undefined,
        });
      } else if (isBillEdit) {
        await save({ dueDate: values.dueDate, notes: values.notes || undefined });
      } else {
        await save(payload);
      }
      notifySuccess(record ? `${config.title} updated` : `${config.title} created`);
      onOpenChange(false);
    } catch (error) {
      setServerError(
        error instanceof ApiRequestError ? error.message : 'Unable to save this document.',
      );
    }
  });

  const partyOptions = (config.party === 'customer' ? customers.data?.data : suppliers.data?.data) ?? [];
  const locked = isInvoiceEdit || isBillEdit;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] max-w-5xl overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle>
            {record ? `Edit ${config.title.toLowerCase()}` : `New ${config.title.toLowerCase()}`}
          </DialogTitle>
          <DialogDescription>
            Totals are recalculated on the server from quantities, discounts and tax.
          </DialogDescription>
        </DialogHeader>

        {serverError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-xs font-medium text-destructive">
            {serverError}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FormField
              label={config.party === 'customer' ? 'Customer' : 'Vendor'}
              htmlFor="document-party"
              required
              error={form.formState.errors[config.party]?.message as string | undefined}
              colSpan={2}
            >
              <Select
                id="document-party"
                disabled={locked}
                {...form.register(config.party)}
              >
                <option value="">Select {config.party === 'customer' ? 'a customer' : 'a vendor'}…</option>
                {partyOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}{option.company ? ` · ${option.company}` : ''}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Warehouse" htmlFor="document-warehouse">
              <Select id="document-warehouse" disabled={locked} {...form.register('warehouse')}>
                <option value="">Default warehouse</option>
                {(warehouses.data?.data ?? []).map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </Select>
            </FormField>

            {kind === 'quotation' && (
              <>
                <FormField label="Quotation date" htmlFor="document-date">
                  <Input id="document-date" type="date" disabled={locked} {...form.register('date')} />
                </FormField>
                <FormField label="Valid until" htmlFor="document-valid" required error={form.formState.errors.validUntil?.message}>
                  <Input id="document-valid" type="date" {...form.register('validUntil')} />
                </FormField>
              </>
            )}

            {kind === 'salesOrder' && (
              <>
                <FormField label="Order date" htmlFor="document-date">
                  <Input id="document-date" type="date" disabled={locked} {...form.register('date')} />
                </FormField>
                <FormField label="Delivery date" htmlFor="document-delivery">
                  <Input id="document-delivery" type="date" disabled={locked} {...form.register('deliveryDate')} />
                </FormField>
              </>
            )}

            {kind === 'invoice' && (
              <>
                <FormField label="Issue date" htmlFor="document-issue">
                  <Input id="document-issue" type="date" disabled={locked} {...form.register('issueDate')} />
                </FormField>
                <FormField label="Due date" htmlFor="document-due">
                  <Input id="document-due" type="date" {...form.register('dueDate')} />
                </FormField>
              </>
            )}

            {kind === 'purchaseOrder' && (
              <>
                <FormField label="Order date" htmlFor="document-date">
                  <Input id="document-date" type="date" disabled={locked} {...form.register('date')} />
                </FormField>
                <FormField label="Expected date" htmlFor="document-expected">
                  <Input id="document-expected" type="date" disabled={locked} {...form.register('expectedDate')} />
                </FormField>
              </>
            )}

            {kind === 'bill' && (
              <>
                <FormField label="Bill date" htmlFor="document-issue">
                  <Input id="document-issue" type="date" disabled={locked} {...form.register('issueDate')} />
                </FormField>
                <FormField label="Due date" htmlFor="document-due" required error={form.formState.errors.dueDate?.message}>
                  <Input id="document-due" type="date" {...form.register('dueDate')} />
                </FormField>
              </>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Line items</p>
              {!locked && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    append({ description: '', quantity: 1, unitPrice: 0, unitCost: 0, discountRate: 0, taxRate: 0 })
                  }
                >
                  <Plus />
                  Add line
                </Button>
              )}
            </div>

            {typeof form.formState.errors.items?.message === 'string' && (
              <p className="text-[11px] font-medium text-destructive">{form.formState.errors.items.message}</p>
            )}

            <div className="space-y-3">
              {fields.map((field, index) => {
                const itemErrors = form.formState.errors.items?.[index];
                return (
                  <div key={field.id} className="rounded-xl border border-border/80 bg-muted/25 p-3.5">
                    <div className="grid gap-3 sm:grid-cols-12">
                      <div className={cn('sm:col-span-4')}>
                        <FormField label="Product" htmlFor={`item-product-${index}`}>
                          <Select
                            id={`item-product-${index}`}
                            value={form.watch(`items.${index}.product`) ?? ''}
                            disabled={locked}
                            onChange={(event) => applyProduct(index, event.target.value)}
                          >
                            <option value="">Custom line</option>
                            {(products.data?.data ?? []).map((product) => (
                              <option key={product.id} value={product.id}>
                                {product.name}{product.sku ? ` (${product.sku})` : ''}
                              </option>
                            ))}
                          </Select>
                        </FormField>
                      </div>
                      <div className="sm:col-span-8">
                        <FormField label="Description" htmlFor={`item-description-${index}`} error={itemErrors?.description?.message}>
                          <Input
                            id={`item-description-${index}`}
                            disabled={locked}
                            placeholder="Item description"
                            {...form.register(`items.${index}.description`)}
                          />
                        </FormField>
                      </div>

                      <div className="sm:col-span-2">
                        <FormField label="Qty" htmlFor={`item-qty-${index}`} error={itemErrors?.quantity?.message}>
                          <Input
                            id={`item-qty-${index}`}
                            type="number"
                            step="0.01"
                            min={0}
                            disabled={locked}
                            {...form.register(`items.${index}.quantity`)}
                          />
                        </FormField>
                      </div>
                      <div className="sm:col-span-2">
                        <FormField label={config.priceField === 'unitCost' ? 'Unit cost' : 'Unit price'} htmlFor={`item-price-${index}`}>
                          <Input
                            id={`item-price-${index}`}
                            type="number"
                            step="0.01"
                            min={0}
                            disabled={locked}
                            {...form.register(`items.${index}.${config.priceField}`)}
                          />
                        </FormField>
                      </div>
                      <div className="sm:col-span-2">
                        <FormField label="Discount %" htmlFor={`item-discount-${index}`}>
                          <Input
                            id={`item-discount-${index}`}
                            type="number"
                            step="0.01"
                            min={0}
                            max={100}
                            disabled={locked}
                            {...form.register(`items.${index}.discountRate`)}
                          />
                        </FormField>
                      </div>
                      <div className="sm:col-span-2">
                        <FormField label="Tax %" htmlFor={`item-tax-${index}`}>
                          <Input
                            id={`item-tax-${index}`}
                            type="number"
                            step="0.01"
                            min={0}
                            max={100}
                            disabled={locked}
                            {...form.register(`items.${index}.taxRate`)}
                          />
                        </FormField>
                      </div>
                      <div className="flex items-end gap-2 sm:col-span-4">
                        <div className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-right">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Line total</p>
                          <p className="text-sm font-semibold">
                            {formatCurrency(
                              computeTotals([form.watch(`items.${index}`) as ItemValues], config.priceField).total,
                              currency,
                            )}
                          </p>
                        </div>
                        {!locked && fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => remove(index)}
                            aria-label="Remove line"
                          >
                            <Trash2 />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="grid gap-4">
              <FormField label="Notes" htmlFor="document-notes">
                <Textarea id="document-notes" rows={3} placeholder="Internal notes or customer-facing remarks" {...form.register('notes')} />
              </FormField>
              {(kind === 'quotation' || kind === 'invoice' || kind === 'purchaseOrder') && (
                <FormField label="Terms" htmlFor="document-terms">
                  <Textarea id="document-terms" rows={3} placeholder="Payment terms and conditions" {...form.register('terms')} />
                </FormField>
              )}
            </div>

            <div className="h-fit rounded-xl border border-border/80 bg-muted/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Summary</p>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd>{formatCurrency(totals.subtotal, currency)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Discount</dt>
                  <dd>−{formatCurrency(totals.discountTotal, currency)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Tax</dt>
                  <dd>{formatCurrency(totals.taxTotal, currency)}</dd>
                </div>
                <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                  <dt>Total</dt>
                  <dd>{formatCurrency(totals.total, currency)}</dd>
                </div>
              </dl>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Final amounts are revalidated by the server when you save.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={form.formState.isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              {record ? 'Save changes' : `Create ${config.title.toLowerCase()}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function useServerError() {
  const [message, setMessage] = useState<string | null>(null);
  return [message, setMessage] as const;
}
