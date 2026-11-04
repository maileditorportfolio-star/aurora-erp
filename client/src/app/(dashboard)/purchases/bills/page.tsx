'use client';

import { useState } from 'react';
import { Ban, CreditCard, Download, Eye } from 'lucide-react';
import { ResourcePage } from '@/components/crud/resource-page';
import { ConfirmDialog } from '@/components/data/confirm-dialog';
import type { RowActionItem } from '@/components/data/row-actions';
import { DocumentFormDialog } from '@/components/documents/document-form';
import { DocumentViewDialog } from '@/components/documents/document-view';
import { PaymentDialog } from '@/components/documents/payment-dialog';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { notifySuccess, useResourceAction } from '@/hooks/use-resource';
import { downloadDocument } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { PERMISSIONS } from '@/lib/permissions';
import { refName } from '@/lib/utils';
import type { DocumentRecord } from '@/lib/types';

export default function BillsPage() {
  const { can, activeOrganization } = useAuth();
  const currency = activeOrganization?.settings?.currency || 'USD';
  const [viewing, setViewing] = useState<DocumentRecord | null>(null);
  const [voiding, setVoiding] = useState<DocumentRecord | null>(null);
  const [paying, setPaying] = useState<DocumentRecord | null>(null);
  const [status, setStatus] = useState('');

  const voidBill = useResourceAction<DocumentRecord>('/bills', ['/dashboard', '/reports']);

  const rowActions = (bill: DocumentRecord): RowActionItem[] => [
    { label: 'View details', icon: Eye, onSelect: () => setViewing(bill) },
    {
      label: 'Download PDF',
      icon: Download,
      onSelect: () => void downloadDocument(`/bills/${bill.id}/pdf`, `${bill.number}.pdf`),
    },
    {
      label: 'Record payment',
      icon: CreditCard,
      hidden: ['void', 'draft', 'paid'].includes(bill.status) || (bill.balance ?? 0) <= 0,
      disabled: !can(PERMISSIONS.PAYMENTS_WRITE),
      onSelect: () => setPaying(bill),
    },
    {
      label: 'Void bill',
      icon: Ban,
      hidden: ['void', 'draft', 'paid'].includes(bill.status) || (bill.amountPaid ?? 0) > 0,
      disabled: !can(PERMISSIONS.BILLS_WRITE),
      destructive: true,
      separatorBefore: true,
      onSelect: () => setVoiding(bill),
    },
  ];

  return (
    <>
      <ResourcePage<DocumentRecord>
        title="Vendor bills"
        description="Supplier invoices, due dates and outstanding payables."
        endpoint="/bills"
        createLabel="New bill"
        searchPlaceholder="Search by bill number…"
        canCreate={can(PERMISSIONS.BILLS_WRITE)}
        canEdit={can(PERMISSIONS.BILLS_WRITE)}
        canDelete={can(PERMISSIONS.BILLS_DELETE)}
        extraParams={status ? { status } : undefined}
        emptyDescription="Record a vendor bill to track what you owe suppliers."
        deleteDescription={(bill) => `${bill.number} will be removed from active lists.`}
        onRowClick={(bill) => setViewing(bill)}
        rowActions={rowActions}
        toolbar={
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-8 rounded-md border border-input bg-card px-2.5 text-xs"
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {['draft', 'open', 'partial', 'paid', 'overdue', 'void'].map((value) => (
              <option key={value} value={value} className="capitalize">
                {value}
              </option>
            ))}
          </select>
        }
        columns={[
          {
            key: 'number',
            header: 'Bill',
            cell: (bill) => (
              <div>
                <p className="font-medium">{bill.number}</p>
                <p className="text-[11px] text-muted-foreground">
                  Issued {formatDate(bill.issueDate)} · due {formatDate(bill.dueDate)}
                </p>
              </div>
            ),
          },
          {
            key: 'supplier',
            header: 'Vendor',
            cell: (bill) => <span className="text-muted-foreground">{refName(bill.supplier)}</span>,
          },
          {
            key: 'total',
            header: 'Total',
            align: 'right',
            cell: (bill) => <span className="font-medium">{formatCurrency(bill.total, currency)}</span>,
          },
          {
            key: 'balance',
            header: 'Balance',
            align: 'right',
            cell: (bill) => (
              <span className={bill.balance && bill.balance > 0 ? 'font-medium text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}>
                {formatCurrency(bill.balance ?? 0, currency)}
              </span>
            ),
          },
          { key: 'status', header: 'Status', cell: (bill) => <StatusBadge status={bill.status} /> },
        ]}
        renderForm={({ record, open, onOpenChange }) => (
          <DocumentFormDialog kind="bill" record={record} open={open} onOpenChange={onOpenChange} />
        )}
      />

      <DocumentViewDialog
        kind="bill"
        record={viewing}
        open={Boolean(viewing)}
        onOpenChange={(open) => !open && setViewing(null)}
        actions={
          viewing ? (
            <>
              <Button
                variant="outline"
                onClick={() => void downloadDocument(`/bills/${viewing.id}/pdf`, `${viewing.number}.pdf`)}
              >
                <Download />
                PDF
              </Button>
              {!['void', 'draft', 'paid'].includes(viewing.status) &&
                (viewing.balance ?? 0) > 0 &&
                can(PERMISSIONS.PAYMENTS_WRITE) && (
                  <Button
                    onClick={() => {
                      setPaying(viewing);
                      setViewing(null);
                    }}
                  >
                    <CreditCard />
                    Record payment
                  </Button>
                )}
            </>
          ) : null
        }
      />

      <ConfirmDialog
        open={Boolean(voiding)}
        onOpenChange={(open) => !open && setVoiding(null)}
        title="Void vendor bill"
        description={
          voiding
            ? `${voiding.number} will be voided and reversing journals posted. Bills with payments cannot be voided.`
            : undefined
        }
        confirmLabel="Void bill"
        loading={voidBill.isPending}
        onConfirm={async () => {
          if (!voiding) return;
          try {
            await voidBill.mutateAsync({ id: voiding.id, action: 'void' });
            notifySuccess('Bill voided');
            setVoiding(null);
          } catch {
            // Errors are surfaced by the mutation hook.
          }
        }}
      />

      <PaymentDialog
        open={Boolean(paying)}
        onOpenChange={(open) => !open && setPaying(null)}
        defaultType="payable"
        defaultBillId={paying?.id}
      />
    </>
  );
}
