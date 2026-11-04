'use client';

import { useState } from 'react';
import { CheckCircle2, Eye, FastForward, XCircle } from 'lucide-react';
import { ResourcePage } from '@/components/crud/resource-page';
import { ConfirmDialog } from '@/components/data/confirm-dialog';
import type { RowActionItem } from '@/components/data/row-actions';
import { DocumentFormDialog } from '@/components/documents/document-form';
import { DocumentViewDialog } from '@/components/documents/document-view';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { notifySuccess, useResourceAction } from '@/hooks/use-resource';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { PERMISSIONS } from '@/lib/permissions';
import { refName } from '@/lib/utils';
import type { DocumentRecord } from '@/lib/types';

interface SalesOrder extends DocumentRecord {
  deliveryDate?: string;
  paymentStatus?: string;
}

interface PendingAction {
  order: SalesOrder;
  action: 'confirm' | 'advance' | 'cancel';
}

const ACTION_COPY: Record<PendingAction['action'], { title: string; description: string; label: string; destructive: boolean }> = {
  confirm: {
    title: 'Confirm sales order',
    description: 'Confirming reserves stock for the ordered quantities and moves the order into fulfilment.',
    label: 'Confirm order',
    destructive: false,
  },
  advance: {
    title: 'Advance order status',
    description: 'Move the order to the next fulfilment stage (confirmed → processing → shipped → delivered).',
    label: 'Advance',
    destructive: false,
  },
  cancel: {
    title: 'Cancel sales order',
    description: 'Any reserved stock will be released. Cancelled orders cannot be fulfilled.',
    label: 'Cancel order',
    destructive: true,
  },
};

export default function SalesOrdersPage() {
  const { can, activeOrganization } = useAuth();
  const currency = activeOrganization?.settings?.currency || 'USD';
  const [viewing, setViewing] = useState<SalesOrder | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [status, setStatus] = useState('');

  const action = useResourceAction<SalesOrder>('/sales-orders', ['/invoices', '/inventory/products']);

  const rowActions = (order: SalesOrder): RowActionItem[] => [
    { label: 'View details', icon: Eye, onSelect: () => setViewing(order) },
    {
      label: 'Confirm order',
      icon: CheckCircle2,
      hidden: !['draft', 'pending'].includes(order.status),
      disabled: !can(PERMISSIONS.SALES_ORDERS_APPROVE),
      onSelect: () => setPending({ order, action: 'confirm' }),
    },
    {
      label: 'Advance status',
      icon: FastForward,
      hidden: !['confirmed', 'processing', 'shipped'].includes(order.status),
      disabled: !can(PERMISSIONS.SALES_ORDERS_WRITE),
      onSelect: () => setPending({ order, action: 'advance' }),
    },
    {
      label: 'Cancel order',
      icon: XCircle,
      hidden: ['cancelled', 'delivered'].includes(order.status),
      disabled: !can(PERMISSIONS.SALES_ORDERS_WRITE),
      destructive: true,
      separatorBefore: true,
      onSelect: () => setPending({ order, action: 'cancel' }),
    },
  ];

  const copy = pending ? ACTION_COPY[pending.action] : null;

  return (
    <>
      <ResourcePage<SalesOrder>
        title="Sales orders"
        description="Confirmed customer orders moving through picking, shipping and delivery."
        endpoint="/sales-orders"
        createLabel="New sales order"
        searchPlaceholder="Search by order number…"
        canCreate={can(PERMISSIONS.SALES_ORDERS_WRITE)}
        canEdit={can(PERMISSIONS.SALES_ORDERS_WRITE)}
        canDelete={can(PERMISSIONS.SALES_ORDERS_DELETE)}
        extraParams={status ? { status } : undefined}
        emptyDescription="Confirm a quotation or create an order to start fulfilment."
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
            {['draft', 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].map((value) => (
              <option key={value} value={value} className="capitalize">
                {value}
              </option>
            ))}
          </select>
        }
        columns={[
          {
            key: 'number',
            header: 'Order',
            cell: (order) => (
              <div>
                <p className="font-medium">{order.number}</p>
                <p className="text-[11px] text-muted-foreground">
                  {formatDate(order.date)}
                  {order.deliveryDate ? ` · delivery ${formatDate(order.deliveryDate)}` : ''}
                </p>
              </div>
            ),
          },
          {
            key: 'customer',
            header: 'Customer',
            cell: (order) => <span className="text-muted-foreground">{refName(order.customer)}</span>,
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
          <DocumentFormDialog kind="salesOrder" record={record} open={open} onOpenChange={onOpenChange} />
        )}
      />

      <DocumentViewDialog
        kind="salesOrder"
        record={viewing}
        open={Boolean(viewing)}
        onOpenChange={(open) => !open && setViewing(null)}
        actions={
          viewing && ['draft', 'pending'].includes(viewing.status) && can(PERMISSIONS.SALES_ORDERS_APPROVE) ? (
            <Button
              onClick={() => {
                setPending({ order: viewing, action: 'confirm' });
                setViewing(null);
              }}
            >
              <CheckCircle2 />
              Confirm order
            </Button>
          ) : null
        }
      />

      <ConfirmDialog
        open={Boolean(pending)}
        onOpenChange={(open) => !open && setPending(null)}
        title={copy?.title ?? 'Update order'}
        description={
          pending && copy
            ? `${pending.order.number}: ${copy.description}`
            : undefined
        }
        confirmLabel={copy?.label}
        destructive={copy?.destructive}
        loading={action.isPending}
        onConfirm={async () => {
          if (!pending) return;
          try {
            await action.mutateAsync({ id: pending.order.id, action: pending.action });
            notifySuccess(copy?.title ? `${copy.title} succeeded` : 'Order updated');
            setPending(null);
          } catch {
            // Errors are surfaced by the mutation hook.
          }
        }}
      />
    </>
  );
}
