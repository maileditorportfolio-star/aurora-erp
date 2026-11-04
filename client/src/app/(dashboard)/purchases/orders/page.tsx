'use client';

import { useState } from 'react';
import { CheckCircle2, Download, Eye } from 'lucide-react';
import { ResourcePage } from '@/components/crud/resource-page';
import { ConfirmDialog } from '@/components/data/confirm-dialog';
import type { RowActionItem } from '@/components/data/row-actions';
import { DocumentFormDialog } from '@/components/documents/document-form';
import { DocumentViewDialog } from '@/components/documents/document-view';
import { StatusBadge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/use-auth';
import { notifySuccess, useResourceAction } from '@/hooks/use-resource';
import { downloadDocument } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { PERMISSIONS } from '@/lib/permissions';
import { refName } from '@/lib/utils';
import type { DocumentRecord } from '@/lib/types';

interface PurchaseOrder extends DocumentRecord {
  expectedDate?: string;
}

export default function PurchaseOrdersPage() {
  const { can, activeOrganization } = useAuth();
  const currency = activeOrganization?.settings?.currency || 'USD';
  const [viewing, setViewing] = useState<PurchaseOrder | null>(null);
  const [approving, setApproving] = useState<PurchaseOrder | null>(null);
  const [status, setStatus] = useState('');

  const approve = useResourceAction<PurchaseOrder>('/purchase-orders', ['/purchases/receipts']);

  const rowActions = (order: PurchaseOrder): RowActionItem[] => [
    { label: 'View details', icon: Eye, onSelect: () => setViewing(order) },
    {
      label: 'Download PDF',
      icon: Download,
      onSelect: () => void downloadDocument(`/purchase-orders/${order.id}/pdf`, `${order.number}.pdf`),
    },
    {
      label: 'Approve order',
      icon: CheckCircle2,
      hidden: !['draft', 'pending'].includes(order.status),
      disabled: !can(PERMISSIONS.PURCHASE_ORDERS_APPROVE),
      separatorBefore: true,
      onSelect: () => setApproving(order),
    },
  ];

  return (
    <>
      <ResourcePage<PurchaseOrder>
        title="Purchase orders"
        description="Orders placed with vendors, from draft through approval and receipt."
        endpoint="/purchase-orders"
        createLabel="New purchase order"
        searchPlaceholder="Search by order number…"
        canCreate={can(PERMISSIONS.PURCHASE_ORDERS_WRITE)}
        canEdit={can(PERMISSIONS.PURCHASE_ORDERS_WRITE)}
        canDelete={can(PERMISSIONS.PURCHASE_ORDERS_DELETE)}
        extraParams={status ? { status } : undefined}
        emptyDescription="Create a purchase order to replenish stock from a vendor."
        deleteDescription={(order) => `${order.number} will be removed from active lists.`}
        onRowClick={(order) => setViewing(order)}
        rowActions={rowActions}
        toolbar={
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-8 rounded-md border border-input bg-card px-2.5 text-xs"
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {['draft', 'pending', 'approved', 'sent', 'partial', 'received', 'cancelled'].map((value) => (
              <option key={value} value={value} className="capitalize">
                {value}
              </option>
            ))}
          </select>
        }
        columns={[
          {
            key: 'number',
            header: 'Purchase order',
            cell: (order) => (
              <div>
                <p className="font-medium">{order.number}</p>
                <p className="text-[11px] text-muted-foreground">
                  {formatDate(order.date)}
                  {order.expectedDate ? ` · expected ${formatDate(order.expectedDate)}` : ''}
                </p>
              </div>
            ),
          },
          {
            key: 'supplier',
            header: 'Vendor',
            cell: (order) => <span className="text-muted-foreground">{refName(order.supplier)}</span>,
          },
          {
            key: 'total',
            header: 'Total',
            align: 'right',
            cell: (order) => <span className="font-medium">{formatCurrency(order.total, currency)}</span>,
          },
          { key: 'status', header: 'Status', cell: (order) => <StatusBadge status={order.status} /> },
        ]}
        renderForm={({ record, open, onOpenChange }) => (
          <DocumentFormDialog kind="purchaseOrder" record={record} open={open} onOpenChange={onOpenChange} />
        )}
      />

      <DocumentViewDialog
        kind="purchaseOrder"
        record={viewing}
        open={Boolean(viewing)}
        onOpenChange={(open) => !open && setViewing(null)}
        actions={
          viewing ? (
            <>
              <button
                type="button"
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-input bg-card px-4 text-sm font-medium hover:bg-accent"
                onClick={() => void downloadDocument(`/purchase-orders/${viewing.id}/pdf`, `${viewing.number}.pdf`)}
              >
                <Download className="size-4" />
                PDF
              </button>
              {['draft', 'pending'].includes(viewing.status) && can(PERMISSIONS.PURCHASE_ORDERS_APPROVE) && (
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  onClick={() => {
                    setApproving(viewing);
                    setViewing(null);
                  }}
                >
                  <CheckCircle2 className="size-4" />
                  Approve order
                </button>
              )}
            </>
          ) : null
        }
      />

      <ConfirmDialog
        open={Boolean(approving)}
        onOpenChange={(open) => !open && setApproving(null)}
        title="Approve purchase order"
        description={
          approving
            ? `${approving.number} will be approved and can be received into the warehouse.`
            : undefined
        }
        confirmLabel="Approve"
        destructive={false}
        loading={approve.isPending}
        onConfirm={async () => {
          if (!approving) return;
          try {
            await approve.mutateAsync({ id: approving.id, action: 'approve' });
            notifySuccess('Purchase order approved');
            setApproving(null);
          } catch {
            // Errors are surfaced by the mutation hook.
          }
        }}
      />
    </>
  );
}
