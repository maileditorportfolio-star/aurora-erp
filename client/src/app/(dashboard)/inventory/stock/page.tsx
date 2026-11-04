'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, SlidersHorizontal } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/data/data-table';
import { Pagination } from '@/components/data/pagination';
import { PageHeader } from '@/components/layout/page-header';
import { useDebounce } from '@/hooks/use-debounce';
import { useAuth } from '@/hooks/use-auth';
import { useResourceList, useResourceOptions } from '@/hooks/use-resource';
import { api, buildQuery } from '@/lib/api';
import { formatDate, formatNumber, humanize } from '@/lib/formatters';
import { PERMISSIONS } from '@/lib/permissions';
import { refName } from '@/lib/utils';
import type { PaginationMeta } from '@/lib/types';
import type { Option, StockLevel, StockMovement } from '@/lib/schemas/stock';
import { AdjustStockDialog, SummaryCard, TransferStockDialog } from '@/components/inventory/stock-dialogs';

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
