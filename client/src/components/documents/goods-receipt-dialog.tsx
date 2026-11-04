'use client';

import { useEffect, useMemo, useState } from 'react';
import { PackageCheck } from 'lucide-react';
import { ApiRequestError, api } from '@/lib/api';
import { formatCurrency } from '@/lib/formatters';
import { useAuth } from '@/hooks/use-auth';
import { notifySuccess, useResourceOptions } from '@/hooks/use-resource';
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
  code?: string;
}

interface OrderLine {
  product?: { id?: string; name?: string; sku?: string } | string;
  description?: string;
  quantity: number;
  unitCost?: number;
}

interface PurchaseOrderOption {
  id: string;
  number: string;
  status: string;
  warehouse?: { id?: string; name?: string } | string | null;
  supplier?: { id?: string; name?: string } | string;
  items?: OrderLine[];
}

interface ReceiptLine {
  product: string;
  description: string;
  orderedQty: number;
  receivedQty: string;
  acceptedQty: string;
  rejectedQty: string;
  unitCost: string;
}

function productId(line: OrderLine) {
  if (!line.product) return '';
  return typeof line.product === 'string' ? line.product : line.product.id ?? '';
}

export function GoodsReceiptDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { activeOrganization } = useAuth();
  const currency = activeOrganization?.settings?.currency || 'USD';
  const orders = useResourceOptions<PurchaseOrderOption>('/purchase-orders', {
    limit: 100,
    status: 'approved',
  });
  const partialOrders = useResourceOptions<PurchaseOrderOption>('/purchase-orders', {
    limit: 100,
    status: 'partial',
  });
  const sentOrders = useResourceOptions<PurchaseOrderOption>('/purchase-orders', {
    limit: 100,
    status: 'sent',
  });
  const warehouses = useResourceOptions<Option>('/warehouses', { limit: 100 });

  const [purchaseOrder, setPurchaseOrder] = useState('');
  const [warehouse, setWarehouse] = useState('');
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<ReceiptLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const orderOptions = useMemo(() => {
    const all = [
      ...(orders.data?.data ?? []),
      ...(partialOrders.data?.data ?? []),
      ...(sentOrders.data?.data ?? []),
    ];
    return all.filter((order, index) => all.findIndex((entry) => entry.id === order.id) === index);
  }, [orders.data, partialOrders.data, sentOrders.data]);

  const selectedOrder = orderOptions.find((order) => order.id === purchaseOrder);

  useEffect(() => {
    if (!open) return;
    setPurchaseOrder('');
    setWarehouse('');
    setReceivedDate(new Date().toISOString().slice(0, 10));
    setNotes('');
    setLines([]);
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!selectedOrder) {
      setLines([]);
      return;
    }
    setLines(
      (selectedOrder.items ?? []).map((line) => ({
        product: productId(line),
        description: line.description ?? '',
        orderedQty: line.quantity,
        receivedQty: String(line.quantity),
        acceptedQty: String(line.quantity),
        rejectedQty: '0',
        unitCost: String(line.unitCost ?? 0),
      })),
    );
    const orderWarehouse =
      selectedOrder.warehouse && typeof selectedOrder.warehouse === 'object'
        ? selectedOrder.warehouse.id
        : selectedOrder.warehouse;
    if (orderWarehouse) setWarehouse(orderWarehouse);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchaseOrder]);

  const updateLine = (index: number, key: keyof ReceiptLine, value: string) => {
    setLines((current) =>
      current.map((line, lineIndex) => (lineIndex === index ? { ...line, [key]: value } : line)),
    );
  };

  const total = lines.reduce(
    (sum, line) => sum + (Number(line.acceptedQty) || 0) * (Number(line.unitCost) || 0),
    0,
  );

  const submit = async () => {
    setError(null);
    if (!purchaseOrder) return setError('Select the purchase order being received.');
    if (!warehouse) return setError('Select a destination warehouse.');
    if (!lines.length) return setError('This purchase order has no line items.');
    if (!lines.some((line) => Number(line.acceptedQty) > 0)) {
      return setError('At least one line must have an accepted quantity.');
    }
    for (const line of lines) {
      if (!line.product) return setError('Every line must reference a product.');
      if (Number(line.acceptedQty) + Number(line.rejectedQty ?? 0) > Number(line.receivedQty) + 0.001) {
        return setError('Accepted plus rejected quantity cannot exceed the received quantity.');
      }
    }

    setSubmitting(true);
    try {
      await api.post('/goods-receipts', {
        purchaseOrder,
        warehouse,
        receivedDate: receivedDate || undefined,
        notes: notes || undefined,
        status: 'received',
        items: lines.map((line) => ({
          product: line.product,
          description: line.description || undefined,
          orderedQty: Number(line.orderedQty) || 0,
          receivedQty: Number(line.receivedQty) || 0,
          acceptedQty: Number(line.acceptedQty) || 0,
          rejectedQty: Number(line.rejectedQty) || 0,
          unitCost: Number(line.unitCost) || 0,
        })),
      });
      notifySuccess('Goods received and stock updated');
      onOpenChange(false);
    } catch (requestError) {
      setError(
        requestError instanceof ApiRequestError
          ? requestError.message
          : 'Unable to record this goods receipt.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] max-w-4xl overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle>New goods receipt</DialogTitle>
          <DialogDescription>
            Receive an approved purchase order into stock. Accepted quantities increase inventory immediately.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-xs font-medium text-destructive">
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Purchase order" htmlFor="grn-order" required colSpan={2}>
            <Select
              id="grn-order"
              value={purchaseOrder}
              onChange={(event) => setPurchaseOrder(event.target.value)}
            >
              <option value="">Select an approved purchase order…</option>
              {orderOptions.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.number} · {typeof order.supplier === 'object' ? order.supplier?.name : order.supplier}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Warehouse" htmlFor="grn-warehouse" required>
            <Select id="grn-warehouse" value={warehouse} onChange={(event) => setWarehouse(event.target.value)}>
              <option value="">Select a warehouse…</option>
              {(warehouses.data?.data ?? []).map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Received date" htmlFor="grn-date">
            <Input
              id="grn-date"
              type="date"
              value={receivedDate}
              onChange={(event) => setReceivedDate(event.target.value)}
            />
          </FormField>
        </div>

        {lines.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-border/80">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-semibold">Product</th>
                  <th className="px-3 py-2 text-right font-semibold">Ordered</th>
                  <th className="px-3 py-2 text-right font-semibold">Received</th>
                  <th className="px-3 py-2 text-right font-semibold">Accepted</th>
                  <th className="px-3 py-2 text-right font-semibold">Rejected</th>
                  <th className="px-3 py-2 text-right font-semibold">Unit cost</th>
                  <th className="px-3 py-2 text-right font-semibold">Line total</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={`${line.product}-${index}`} className="border-t border-border/60">
                    <td className="min-w-40 px-3 py-2">
                      <p className="font-medium">{line.description || 'Product'}</p>
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{line.orderedQty}</td>
                    <td className="px-2 py-2">
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={line.receivedQty}
                        onChange={(event) => updateLine(index, 'receivedQty', event.target.value)}
                        className="h-8 w-24 text-right"
                        aria-label="Received quantity"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={line.acceptedQty}
                        onChange={(event) => updateLine(index, 'acceptedQty', event.target.value)}
                        className="h-8 w-24 text-right"
                        aria-label="Accepted quantity"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={line.rejectedQty}
                        onChange={(event) => updateLine(index, 'rejectedQty', event.target.value)}
                        className="h-8 w-24 text-right"
                        aria-label="Rejected quantity"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={line.unitCost}
                        onChange={(event) => updateLine(index, 'unitCost', event.target.value)}
                        className="h-8 w-24 text-right"
                        aria-label="Unit cost"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-medium">
                      {formatCurrency(
                        (Number(line.acceptedQty) || 0) * (Number(line.unitCost) || 0),
                        currency,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!lines.length && purchaseOrder && (
          <p className="rounded-lg border border-border/80 bg-muted/30 px-3 py-6 text-center text-xs text-muted-foreground">
            No received quantities available for this order.
          </p>
        )}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <FormField label="Notes" htmlFor="grn-notes" className="flex-1">
            <Textarea
              id="grn-notes"
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Condition notes, delivery reference…"
            />
          </FormField>
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-2 text-right">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Receipt total</p>
            <p className="text-base font-semibold">{formatCurrency(total, currency)}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={submitting}>
            <PackageCheck />
            Receive goods
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
