'use client';

import { useState } from 'react';
import { Eye, PackageCheck, Plus } from 'lucide-react';
import { ResourcePage } from '@/components/crud/resource-page';
import { ConfirmDialog } from '@/components/data/confirm-dialog';
import type { RowActionItem } from '@/components/data/row-actions';
import { GoodsReceiptDialog } from '@/components/documents/goods-receipt-dialog';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/use-auth';
import { notifySuccess, useResourceAction } from '@/hooks/use-resource';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { PERMISSIONS } from '@/lib/permissions';
import { refName } from '@/lib/utils';

interface ReceiptLine {
  id?: string;
  product?: { id?: string; name?: string; sku?: string; unit?: string } | string;
  description?: string;
  orderedQty?: number;
  receivedQty: number;
  acceptedQty: number;
  rejectedQty?: number;
  unitCost?: number;
  total?: number;
}

interface GoodsReceipt {
  id: string;
  number: string;
  purchaseOrder?: { id?: string; number?: string; status?: string } | string;
  supplier?: { id?: string; name?: string; company?: string } | string;
  warehouse?: { id?: string; name?: string; code?: string } | string;
  receivedDate?: string;
  total: number;
  status: string;
  stockApplied?: boolean;
  notes?: string;
  items?: ReceiptLine[];
}

export default function GoodsReceiptsPage() {
  const { can, activeOrganization } = useAuth();
  const currency = activeOrganization?.settings?.currency || 'USD';
  const [createOpen, setCreateOpen] = useState(false);
  const [viewing, setViewing] = useState<GoodsReceipt | null>(null);
  const [receiving, setReceiving] = useState<GoodsReceipt | null>(null);
  const [status, setStatus] = useState('');

  const receive = useResourceAction<GoodsReceipt>('/goods-receipts', [
    '/inventory/products',
    '/purchase-orders',
  ]);

  const rowActions = (receipt: GoodsReceipt): RowActionItem[] => [
    { label: 'View details', icon: Eye, onSelect: () => setViewing(receipt) },
    {
      label: 'Receive into stock',
      icon: PackageCheck,
      hidden: receipt.status !== 'draft' || receipt.stockApplied,
      disabled: !can(PERMISSIONS.GOODS_RECEIPTS_WRITE),
      separatorBefore: true,
      onSelect: () => setReceiving(receipt),
    },
  ];

  return (
    <>
      <ResourcePage<GoodsReceipt>
        title="Goods receipts"
        description="Inbound deliveries received against purchase orders and added to stock."
        endpoint="/goods-receipts"
        searchPlaceholder="Search by receipt number…"
        canCreate={false}
        canEdit={false}
        canDelete={can(PERMISSIONS.GOODS_RECEIPTS_DELETE)}
        extraParams={status ? { status } : undefined}
        emptyDescription="Receive an approved purchase order to create a goods receipt."
        deleteTitle="Delete goods receipt"
        deleteDescription={(receipt) =>
          `${receipt.number} will be deleted. Any stock received will be reversed.`
        }
        onRowClick={(receipt) => setViewing(receipt)}
        rowActions={rowActions}
        headerActions={
          can(PERMISSIONS.GOODS_RECEIPTS_WRITE) ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus />
              New receipt
            </Button>
          ) : undefined
        }
        toolbar={
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-8 rounded-md border border-input bg-card px-2.5 text-xs"
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {['draft', 'received', 'cancelled'].map((value) => (
              <option key={value} value={value} className="capitalize">
                {value}
              </option>
            ))}
          </select>
        }
        columns={[
          {
            key: 'number',
            header: 'Receipt',
            cell: (receipt) => (
              <div>
                <p className="font-medium">{receipt.number}</p>
                <p className="text-[11px] text-muted-foreground">
                  {formatDate(receipt.receivedDate)} · PO {typeof receipt.purchaseOrder === 'object' ? receipt.purchaseOrder?.number : refName(receipt.purchaseOrder)}
                </p>
              </div>
            ),
          },
          {
            key: 'supplier',
            header: 'Vendor',
            cell: (receipt) => <span className="text-muted-foreground">{refName(receipt.supplier)}</span>,
          },
          {
            key: 'warehouse',
            header: 'Warehouse',
            cell: (receipt) => <span className="text-muted-foreground">{refName(receipt.warehouse)}</span>,
          },
          {
            key: 'total',
            header: 'Value',
            align: 'right',
            cell: (receipt) => <span className="font-medium">{formatCurrency(receipt.total, currency)}</span>,
          },
          { key: 'status', header: 'Status', cell: (receipt) => <StatusBadge status={receipt.status} /> },
        ]}
      />

      <GoodsReceiptDialog open={createOpen} onOpenChange={setCreateOpen} />

      <Dialog open={Boolean(viewing)} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto scrollbar-thin">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <DialogTitle>{viewing?.number}</DialogTitle>
              <StatusBadge status={viewing?.status} />
            </div>
            <DialogDescription>Received quantities and accepted stock.</DialogDescription>
          </DialogHeader>

          {viewing && (
            <>
              <div className="grid gap-3 rounded-xl border border-border/80 bg-muted/25 p-4 text-xs sm:grid-cols-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Vendor</p>
                  <p className="mt-0.5 font-medium">{refName(viewing.supplier)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Purchase order</p>
                  <p className="mt-0.5 font-medium">
                    {typeof viewing.purchaseOrder === 'object' ? viewing.purchaseOrder?.number : refName(viewing.purchaseOrder)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Warehouse</p>
                  <p className="mt-0.5 font-medium">{refName(viewing.warehouse)}</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-border/80">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Product</th>
                      <th className="px-3 py-2 text-right font-semibold">Ordered</th>
                      <th className="px-3 py-2 text-right font-semibold">Received</th>
                      <th className="px-3 py-2 text-right font-semibold">Accepted</th>
                      <th className="px-3 py-2 text-right font-semibold">Rejected</th>
                      <th className="px-3 py-2 text-right font-semibold">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(viewing.items ?? []).map((line, index) => (
                      <tr key={line.id ?? index} className="border-t border-border/60">
                        <td className="px-3 py-2">{line.description || refName(line.product)}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{line.orderedQty ?? '—'}</td>
                        <td className="px-3 py-2 text-right">{line.receivedQty}</td>
                        <td className="px-3 py-2 text-right font-medium">{line.acceptedQty}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{line.rejectedQty ?? 0}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(line.total ?? 0, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {viewing.notes && (
                <div className="rounded-lg border border-border/80 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Notes</p>
                  <p className="mt-1 whitespace-pre-wrap text-xs">{viewing.notes}</p>
                </div>
              )}
            </>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewing(null)}>
              Close
            </Button>
            {viewing && viewing.status === 'draft' && !viewing.stockApplied && can(PERMISSIONS.GOODS_RECEIPTS_WRITE) && (
              <Button
                onClick={() => {
                  setReceiving(viewing);
                  setViewing(null);
                }}
              >
                <PackageCheck />
                Receive into stock
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(receiving)}
        onOpenChange={(open) => !open && setReceiving(null)}
        title="Receive goods into stock"
        description={
          receiving
            ? `${receiving.number} will add the accepted quantities to inventory and update the purchase order.`
            : undefined
        }
        confirmLabel="Receive"
        destructive={false}
        loading={receive.isPending}
        onConfirm={async () => {
          if (!receiving) return;
          try {
            await receive.mutateAsync({ id: receiving.id, action: 'receive' });
            notifySuccess('Stock received');
            setReceiving(null);
          } catch {
            // Errors are surfaced by the mutation hook.
          }
        }}
      />
    </>
  );
}
