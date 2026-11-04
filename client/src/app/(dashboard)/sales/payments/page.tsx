'use client';

import { useState } from 'react';
import { CreditCard, Eye, Plus } from 'lucide-react';
import { ResourcePage } from '@/components/crud/resource-page';
import type { RowActionItem } from '@/components/data/row-actions';
import { PaymentDialog } from '@/components/documents/payment-dialog';
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
import { formatCurrency, formatDate } from '@/lib/formatters';
import { PERMISSIONS } from '@/lib/permissions';
import { refName } from '@/lib/utils';

interface Payment {
  id: string;
  number: string;
  type: 'receivable' | 'payable';
  amount: number;
  currency?: string;
  method?: string;
  reference?: string;
  date?: string;
  notes?: string;
  customer?: { id?: string; name?: string; company?: string } | string | null;
  supplier?: { id?: string; name?: string; company?: string } | string | null;
  invoice?: { id?: string; number?: string; total?: number; balance?: number; status?: string } | string | null;
  bill?: { id?: string; number?: string; total?: number; balance?: number; status?: string } | string | null;
  createdAt?: string;
}

export default function PaymentsPage() {
  const { can, activeOrganization } = useAuth();
  const currency = activeOrganization?.settings?.currency || 'USD';
  const [createOpen, setCreateOpen] = useState(false);
  const [defaultType, setDefaultType] = useState<'receivable' | 'payable'>('receivable');
  const [viewing, setViewing] = useState<Payment | null>(null);
  const [type, setType] = useState('');

  const openCreate = (nextType: 'receivable' | 'payable') => {
    setDefaultType(nextType);
    setCreateOpen(true);
  };

  const rowActions = (payment: Payment): RowActionItem[] => [
    { label: 'View details', icon: Eye, onSelect: () => setViewing(payment) },
  ];

  return (
    <>
      <ResourcePage<Payment>
        title="Payments"
        description="Customer receipts and vendor payments, reconciled against invoices and bills."
        endpoint="/payments"
        searchPlaceholder="Search by payment or reference…"
        canCreate={false}
        canEdit={false}
        canDelete={can(PERMISSIONS.PAYMENTS_DELETE)}
        extraParams={type ? { type } : undefined}
        emptyDescription="Record a payment from an invoice, bill or the button above."
        deleteTitle="Delete payment"
        deleteDescription={(payment) =>
          `${payment.number} will be deleted and the linked invoice or bill balance restored.`
        }
        onRowClick={(payment) => setViewing(payment)}
        rowActions={rowActions}
        headerActions={
          <>
            {can(PERMISSIONS.PAYMENTS_WRITE) && (
              <>
                <Button variant="outline" onClick={() => openCreate('payable')}>
                  <CreditCard />
                  Vendor payment
                </Button>
                <Button onClick={() => openCreate('receivable')}>
                  <Plus />
                  Record receipt
                </Button>
              </>
            )}
          </>
        }
        toolbar={
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
            className="h-8 rounded-md border border-input bg-card px-2.5 text-xs"
            aria-label="Filter by type"
          >
            <option value="">All payments</option>
            <option value="receivable">Customer receipts</option>
            <option value="payable">Vendor payments</option>
          </select>
        }
        columns={[
          {
            key: 'number',
            header: 'Payment',
            cell: (payment) => (
              <div>
                <p className="font-medium">{payment.number}</p>
                <p className="text-[11px] text-muted-foreground">
                  {formatDate(payment.date)} · {payment.method ?? 'bank'}
                </p>
              </div>
            ),
          },
          {
            key: 'party',
            header: 'Party',
            cell: (payment) => (
              <div>
                <p className="text-muted-foreground">
                  {refName(payment.customer ?? payment.supplier)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {docNumber(payment.invoice) ?? docNumber(payment.bill) ?? 'On account'}
                </p>
              </div>
            ),
          },
          {
            key: 'type',
            header: 'Type',
            cell: (payment) => (
              <span className="capitalize text-muted-foreground">
                {payment.type === 'receivable' ? 'Receipt' : 'Payment'}
              </span>
            ),
          },
          {
            key: 'amount',
            header: 'Amount',
            align: 'right',
            cell: (payment) => (
              <span className={payment.type === 'receivable' ? 'font-medium text-emerald-600 dark:text-emerald-400' : 'font-medium text-amber-600 dark:text-amber-400'}>
                {payment.type === 'receivable' ? '+' : '−'}
                {formatCurrency(payment.amount, payment.currency || currency)}
              </span>
            ),
          },
        ]}
      />

      <PaymentDialog open={createOpen} onOpenChange={setCreateOpen} defaultType={defaultType} />

      <Dialog open={Boolean(viewing)} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewing?.number}</DialogTitle>
            <DialogDescription>Payment details and linked document.</DialogDescription>
          </DialogHeader>
          {viewing && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-border/80 bg-muted/30 p-3">
                <Detail label="Party" value={refName(viewing.customer ?? viewing.supplier)} />
                <Detail label="Type" value={viewing.type === 'receivable' ? 'Customer receipt' : 'Vendor payment'} />
                <Detail label="Amount" value={formatCurrency(viewing.amount, viewing.currency || currency)} />
                <Detail label="Method" value={viewing.method ?? 'bank'} />
                <Detail label="Date" value={formatDate(viewing.date)} />
                <Detail label="Reference" value={viewing.reference || '—'} />
              </div>
              <div className="rounded-lg border border-border/80 p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Linked document</p>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <span className="font-medium">
                    {docNumber(viewing.invoice) ?? docNumber(viewing.bill) ?? 'On account'}
                  </span>
                  {docStatus(viewing.invoice) && <StatusBadge status={docStatus(viewing.invoice)} />}
                  {docStatus(viewing.bill) && <StatusBadge status={docStatus(viewing.bill)} />}
                </div>
              </div>
              {viewing.notes && (
                <div className="rounded-lg border border-border/80 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Notes</p>
                  <p className="mt-1 whitespace-pre-wrap text-xs">{viewing.notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewing(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium capitalize">{value}</p>
    </div>
  );
}

function docNumber(ref: Payment['invoice'] | Payment['bill']) {
  return ref && typeof ref === 'object' ? ref.number : undefined;
}

function docStatus(ref: Payment['invoice'] | Payment['bill']) {
  return ref && typeof ref === 'object' ? ref.status : undefined;
}
