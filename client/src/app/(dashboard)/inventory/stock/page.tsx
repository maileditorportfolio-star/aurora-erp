'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, SlidersHorizontal } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/data/data-table';
import { Pagination } from '@/components/data/pagination';
import { FormField } from '@/components/data/form-field';
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
  notifySuccess,
  useResourceList,
  useResourceOptions,
} from '@/hooks/use-resource';
import { ApiRequestError, api, buildQuery } from '@/lib/api';
import { formatDate, formatNumber, humanize } from '@/lib/formatters';
import { PERMISSIONS } from '@/lib/permissions';
import { refName } from '@/lib/utils';
import type { PaginationMeta } from '@/lib/types';

interface Option {
  id: string;
  name: string;
  code?: string;
  sku?: string;
  unit?: string;
}

interface StockLevel {
  id: string;
  product?: {
    id?: string;
    name?: string;
    sku?: string;
    unit?: string;
    stock?: number;
    reserved?: number;
    reorderPoint?: number;
  } | string;
  warehouse?: { id?: string; name?: string; code?: string } | string;
  quantity: number;
  reserved?: number;
  reorderPoint?: number;
  updatedAt?: string;
}

interface StockMovement {
  id: string;
  product?: { id?: string; name?: string; sku?: string; unit?: string } | string;
  warehouse?: { id?: string; name?: string; code?: string } | string;
  type: string;
  quantity: number;
  direction: 'in' | 'out';
  referenceType?: string;
  referenceNumber?: string;
  note?: string;
  balanceAfter?: number;
  createdBy?: { id?: string; name?: string } | string;
  createdAt?: string;
}

export default function StockPage() {
  const { can, activeOrganization } = useAuth();
  const currency = activeOrganization?.settings?.currency || 'USD';
  const queryClient = useQueryClient();
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [movementType, setMovementType] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [adjusting, setAdjusting] = useState<StockLevel | null>(null);
  const [transferring, setTransferring] = useState<StockLevel | null>(null);

  const warehouses = useResourceOptions<Option>('/warehouses', { limit: 100 });
  const products = useResourceOptions<Option>('/products', { limit: 100 });

  const levels = useQuery<StockLevel[]>({
    queryKey: ['/products/stock/levels', { warehouseFilter, lowStockOnly }],
    queryFn: () =>
      api.get<StockLevel[]>(
        `/products/stock/levels${buildQuery({
          warehouseId: warehouseFilter || undefined,
          lowStock: lowStockOnly ? 'true' : undefined,
        })}`,
      ),
  });

  const movements = useResourceList<StockMovement>('/products/stock/movements', {
    page,
    limit,
    search: debouncedSearch || undefined,
    productId: productFilter || undefined,
    warehouseId: warehouseFilter || undefined,
    type: movementType || undefined,
  });

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['/products/stock/levels'] }),
      queryClient.invalidateQueries({ queryKey: ['/products/stock/movements'] }),
      queryClient.invalidateQueries({ queryKey: ['/products'] }),
    ]);
  };

  const levelRows = levels.data ?? [];
  const lowStockCount = levelRows.filter((level) => {
    const productReorder = typeof level.product === 'object' ? level.product?.reorderPoint ?? 0 : 0;
    return level.quantity <= (level.reorderPoint ?? productReorder);
  }).length;
  const totalUnits = levelRows.reduce((sum, level) => sum + level.quantity, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Stock levels"
        description="Warehouse balances, movements and adjustments across your inventory."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Stock keeping units" value={formatNumber(levelRows.length)} hint="Product / warehouse combinations" />
        <SummaryCard label="Units on hand" value={formatNumber(totalUnits)} hint="Across the selected warehouses" />
        <SummaryCard label="At or below reorder" value={formatNumber(lowStockCount)} hint="Needs replenishment" tone="warning" />
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="w-48">
          <label className="mb-1 block text-[11px] font-medium text-muted-foreground" htmlFor="stock-warehouse">
            Warehouse
          </label>
          <Select id="stock-warehouse" value={warehouseFilter} onChange={(event) => setWarehouseFilter(event.target.value)}>
            <option value="">All warehouses</option>
            {(warehouses.data?.data ?? []).map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
            ))}
          </Select>
        </div>
        <div className="w-52">
          <label className="mb-1 block text-[11px] font-medium text-muted-foreground" htmlFor="stock-product">
            Product
          </label>
          <Select id="stock-product" value={productFilter} onChange={(event) => setProductFilter(event.target.value)}>
            <option value="">All products</option>
            {(products.data?.data ?? []).map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}{product.sku ? ` (${product.sku})` : ''}
              </option>
            ))}
          </Select>
        </div>
        <Button
          variant={lowStockOnly ? 'default' : 'outline'}
          onClick={() => setLowStockOnly((value) => !value)}
        >
          Low stock only
        </Button>
      </div>

      <Tabs defaultValue="levels">
        <TabsList>
          <TabsTrigger value="levels">Levels</TabsTrigger>
          <TabsTrigger value="movements">Movements</TabsTrigger>
        </TabsList>

        <TabsContent value="levels">
          <Card className="overflow-hidden">
            <DataTable<StockLevel>
              columns={[
                {
                  key: 'product',
                  header: 'Product',
                  cell: (level) => (
                    <div>
                      <p className="font-medium">{refName(level.product)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {typeof level.product === 'object' ? level.product.sku : ''}
                        {typeof level.product === 'object' && level.product.unit ? ` · ${level.product.unit}` : ''}
                      </p>
                    </div>
                  ),
                },
                {
                  key: 'warehouse',
                  header: 'Warehouse',
                  cell: (level) => <span className="text-muted-foreground">{refName(level.warehouse)}</span>,
                },
                {
                  key: 'quantity',
                  header: 'On hand',
                  align: 'right',
                  cell: (level) => <span className="font-medium">{formatNumber(level.quantity)}</span>,
                },
                {
                  key: 'reserved',
                  header: 'Reserved',
                  align: 'right',
                  cell: (level) => formatNumber(level.reserved ?? 0),
                },
                {
                  key: 'available',
                  header: 'Available',
                  align: 'right',
                  cell: (level) => formatNumber(Math.max(0, level.quantity - (level.reserved ?? 0))),
                },
                {
                  key: 'reorder',
                  header: 'Reorder at',
                  align: 'right',
                  cell: (level) => (
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-muted-foreground">{formatNumber(level.reorderPoint ?? 0)}</span>
                      {level.quantity <= (level.reorderPoint ?? 0) && <Badge variant="warning">Low</Badge>}
                    </div>
                  ),
                },
                {
                  key: 'actions',
                  header: '',
                  className: 'w-48 text-right',
                  cell: (level) => (
                    <div className="flex justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!can(PERMISSIONS.INVENTORY_WRITE)}
                        onClick={() => setAdjusting(level)}
                      >
                        <SlidersHorizontal />
                        Adjust
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!can(PERMISSIONS.INVENTORY_WRITE)}
                        onClick={() => setTransferring(level)}
                      >
                        <ArrowLeftRight />
                        Transfer
                      </Button>
                    </div>
                  ),
                },
              ]}
              rows={levelRows}
              loading={levels.isLoading}
              emptyTitle="No stock levels yet"
              emptyDescription="Stock levels appear once products are received or invoiced."
            />
          </Card>
        </TabsContent>

        <TabsContent value="movements">
          <Card className="overflow-hidden">
            <div className="flex flex-col gap-2 border-b border-border/70 p-4 sm:flex-row sm:items-center sm:justify-between">
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search reference or note…"
                className="w-full sm:max-w-xs"
              />
              <Select
                value={movementType}
                onChange={(event) => {
                  setMovementType(event.target.value);
                  setPage(1);
                }}
                className="h-9 w-full sm:w-48"
              >
                <option value="">All movement types</option>
                {['receipt', 'issue', 'adjustment', 'transfer_in', 'transfer_out', 'reservation', 'release'].map((type) => (
                  <option key={type} value={type} className="capitalize">{humanize(type)}</option>
                ))}
              </Select>
            </div>
            <DataTable<StockMovement>
              columns={[
                {
                  key: 'date',
                  header: 'Date',
                  cell: (movement) => (
                    <span className="text-muted-foreground">{formatDate(movement.createdAt)}</span>
                  ),
                },
                {
                  key: 'product',
                  header: 'Product',
                  cell: (movement) => (
                    <div>
                      <p className="font-medium">{refName(movement.product)}</p>
                      <p className="text-[11px] text-muted-foreground">{refName(movement.warehouse)}</p>
                    </div>
                  ),
                },
                { key: 'type', header: 'Type', cell: (movement) => <StatusBadge status={movement.type} /> },
                {
                  key: 'quantity',
                  header: 'Quantity',
                  align: 'right',
                  cell: (movement) => (
                    <span className={movement.direction === 'in' ? 'font-medium text-emerald-600 dark:text-emerald-400' : 'font-medium text-amber-600 dark:text-amber-400'}>
                      {movement.direction === 'in' ? '+' : '−'}
                      {formatNumber(movement.quantity)}
                    </span>
                  ),
                },
                {
                  key: 'balance',
                  header: 'Balance',
                  align: 'right',
                  cell: (movement) => formatNumber(movement.balanceAfter ?? 0),
                },
                {
                  key: 'reference',
                  header: 'Reference',
                  cell: (movement) => (
                    <div>
                      <p className="text-muted-foreground">{movement.referenceNumber || humanize(movement.referenceType)}</p>
                      {movement.note && <p className="text-[11px] text-muted-foreground">{movement.note}</p>}
                    </div>
                  ),
                },
                {
                  key: 'actor',
                  header: 'By',
                  cell: (movement) => <span className="text-muted-foreground">{refName(movement.createdBy)}</span>,
                },
              ]}
              rows={movements.data?.data ?? []}
              loading={movements.isLoading}
              emptyTitle="No stock movements"
              emptyDescription="Receipts, issues and adjustments will be listed here."
            />
            <Pagination
              meta={movements.data?.meta as PaginationMeta | null}
              page={page}
              limit={limit}
              onPageChange={setPage}
              onLimitChange={(value) => {
                setLimit(value);
                setPage(1);
              }}
            />
          </Card>
        </TabsContent>
      </Tabs>

      <AdjustStockDialog
        level={adjusting}
        onOpenChange={(open) => !open && setAdjusting(null)}
        currency={currency}
        onSaved={invalidate}
      />
      <TransferStockDialog
        level={transferring}
        warehouses={warehouses.data?.data ?? []}
        onOpenChange={(open) => !open && setTransferring(null)}
        onSaved={invalidate}
      />
    </div>
  );
}

function SummaryCard({
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

function AdjustStockDialog({
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

function TransferStockDialog({
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
