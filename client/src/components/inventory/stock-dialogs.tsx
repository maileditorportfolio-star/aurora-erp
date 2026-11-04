'use client';
import { useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { FormField } from '@/components/data/form-field';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { notifySuccess } from '@/hooks/use-resource';
import { ApiRequestError, api } from '@/lib/api';
import { formatNumber } from '@/lib/formatters';
import { refName } from '@/lib/utils';
import type { Option, StockLevel } from '@/lib/schemas/stock';
export function SummaryCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint: string;
  tone?: 'default' | 'warning';
}) {
  return (
    <Card className="p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={tone === 'warning' ? 'mt-1 text-2xl font-semibold text-amber-600 dark:text-amber-400' : 'mt-1 text-2xl font-semibold'}>{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
    </Card>
  );
}

export function AdjustStockDialog({
  level,
  onOpenChange,
  currency,
  onSaved,
}: {
  level: StockLevel | null;
  onOpenChange: (open: boolean) => void;
  currency: string;
  onSaved: () => Promise<void>;
}) {
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const open = Boolean(level);
  const productId = level && typeof level.product === 'object' ? level.product.id : undefined;
  const warehouseId = level && typeof level.warehouse === 'object' ? level.warehouse.id : undefined;

  const reset = () => {
    setQuantity(String(level?.quantity ?? 0));
    setNote('');
    setError(null);
  };

  const save = async () => {
    if (!productId) return setError('This stock level is missing a product reference.');
    if (quantity === '' || Number(quantity) < 0) return setError('Enter a target quantity of zero or more.');
    setSaving(true);
    setError(null);
    try {
      await api.post('/products/stock/adjust', {
        productId,
        warehouseId,
        quantity: Number(quantity),
        note: note || undefined,
      });
      notifySuccess('Stock adjusted');
      await onSaved();
      onOpenChange(false);
    } catch (requestError) {
      setError(requestError instanceof ApiRequestError ? requestError.message : 'Unable to adjust stock.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (next) reset();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription>
            Set the counted on-hand quantity for {refName(level?.product)} in {refName(level?.warehouse)}.
          </DialogDescription>
        </DialogHeader>

        {!open ? null : (
          <>
            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-xs font-medium text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-border/80 bg-muted/30 p-3 text-xs">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Current on hand</p>
                  <p className="mt-0.5 font-semibold">{formatNumber(level?.quantity ?? 0)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Reserved</p>
                  <p className="mt-0.5 font-semibold">{formatNumber(level?.reserved ?? 0)}</p>
                </div>
              </div>
              <FormField label="Counted quantity" htmlFor="adjust-quantity" required>
                <Input
                  id="adjust-quantity"
                  type="number"
                  min={0}
                  step="0.01"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
              </FormField>
              <FormField label="Reason" htmlFor="adjust-note" hint={`Values are recorded in ${currency}.`}>
                <Textarea
                  id="adjust-note"
                  rows={2}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Cycle count, damage, write-off…"
                />
              </FormField>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={() => void save()} loading={saving}>
                Save adjustment
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function TransferStockDialog({
  level,
  warehouses,
  onOpenChange,
  onSaved,
}: {
  level: StockLevel | null;
  warehouses: Option[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const [destination, setDestination] = useState('');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const open = Boolean(level);
  const productId = level && typeof level.product === 'object' ? level.product.id : undefined;
  const sourceId = level && typeof level.warehouse === 'object' ? level.warehouse.id : undefined;

  const save = async () => {
    if (!productId || !sourceId) return setError('This stock level is missing a product or warehouse.');
    if (!destination) return setError('Select a destination warehouse.');
    if (!quantity || Number(quantity) <= 0) return setError('Enter a quantity greater than zero.');
    if (Number(quantity) > (level?.quantity ?? 0)) return setError('Transfer quantity exceeds on-hand stock.');
    setSaving(true);
    setError(null);
    try {
      await api.post('/products/stock/transfer', {
        productId,
        fromWarehouseId: sourceId,
        toWarehouseId: destination,
        quantity: Number(quantity),
        note: note || undefined,
      });
      notifySuccess('Stock transferred');
      await onSaved();
      onOpenChange(false);
    } catch (requestError) {
      setError(requestError instanceof ApiRequestError ? requestError.message : 'Unable to transfer stock.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (next) {
          setDestination('');
          setQuantity('');
          setNote('');
          setError(null);
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer stock</DialogTitle>
          <DialogDescription>
            Move {refName(level?.product)} from {refName(level?.warehouse)} to another warehouse.
          </DialogDescription>
        </DialogHeader>

        {!open ? null : (
          <>
            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-xs font-medium text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-border/80 bg-muted/30 p-3 text-xs">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Source</p>
                  <p className="mt-0.5 font-semibold">{refName(level?.warehouse)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Available</p>
                  <p className="mt-0.5 font-semibold">
                    {formatNumber(Math.max(0, (level?.quantity ?? 0) - (level?.reserved ?? 0)))}
                  </p>
                </div>
              </div>
              <FormField label="Destination warehouse" htmlFor="transfer-warehouse" required>
                <Select id="transfer-warehouse" value={destination} onChange={(event) => setDestination(event.target.value)}>
                  <option value="">Select warehouse…</option>
                  {warehouses
                    .filter((warehouse) => warehouse.id !== sourceId)
                    .map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                    ))}
                </Select>
              </FormField>
              <FormField label="Quantity" htmlFor="transfer-quantity" required>
                <Input
                  id="transfer-quantity"
                  type="number"
                  min={0}
                  step="0.01"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
              </FormField>
              <FormField label="Note" htmlFor="transfer-note">
                <Textarea
                  id="transfer-note"
                  rows={2}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Reason for transfer…"
                />
              </FormField>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={() => void save()} loading={saving}>
                <ArrowLeftRight />
                Transfer
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
