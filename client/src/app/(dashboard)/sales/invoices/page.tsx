'use client';

import { useState } from 'react';
import { Ban, CreditCard, Download, Eye, Send } from 'lucide-react';
import { ResourcePage } from '@/components/crud/resource-page';
import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { PromptDialog } from '@/components/data/prompt-dialog';
import type { RowActionItem } from '@/components/data/row-actions';
import { DocumentFormDialog } from '@/components/documents/document-form';
import { DocumentViewDialog } from '@/components/documents/document-view';
import { PaymentDialog } from '@/components/documents/payment-dialog';
import { StatusBadge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/use-auth';
import { notifySuccess, useResourceAction } from '@/hooks/use-resource';
import { downloadDocument } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { PERMISSIONS } from '@/lib/permissions';
import { refName } from '@/lib/utils';
import type { DocumentRecord } from '@/lib/types';

export default function InvoicesPage() {
  const { can, activeOrganization } = useAuth();
  const currency = activeOrganization?.settings?.currency || 'USD';
  const [viewing, setViewing] = useState<DocumentRecord | null>(null);
  const [issuing, setIssuing] = useState<DocumentRecord | null>(null);
  const [voiding, setVoiding] = useState<DocumentRecord | null>(null);
  const [paying, setPaying] = useState<DocumentRecord | null>(null);
  const [status, setStatus] = useState('');

  const action = useResourceAction<DocumentRecord>('/invoices', [
    '/dashboard',
    '/payments',
    '/inventory/products',
  ]);
  const voidInvoice = useResourceAction<DocumentRecord>('/invoices', [
    '/dashboard',
    '/reports',
  ]);

  const rowActions = (invoice: DocumentRecord): RowActionItem[] => [
    { label: 'View details', icon: Eye, onSelect: () => setViewing(invoice) },
    {
      label: 'Download PDF',
      icon: Download,
      onSelect: () => void downloadDocument(`/invoices/${invoice.id}/pdf`, `${invoice.number}.pdf`),
    },
    {
      label: 'Record payment',
      icon: CreditCard,
      hidden: invoice.status === 'void' || invoice.status === 'draft' || (invoice.balance ?? 0) <= 0,
      disabled: !can(PERMISSIONS.PAYMENTS_WRITE),
      onSelect: () => setPaying(invoice),
    },
    {
      label: 'Issue invoice',
      icon: Send,
      hidden: invoice.status !== 'draft',
      disabled: !can(PERMISSIONS.INVOICES_WRITE),
      separatorBefore: true,
      onSelect: () => setIssuing(invoice),
    },
    {
      label: 'Void invoice',
      icon: Ban,
      hidden: ['void', 'draft', 'paid'].includes(invoice.status),
      disabled: !can(PERMISSIONS.INVOICES_VOID),
      destructive: true,
      separatorBefore: true,
      onSelect: () => setVoiding(invoice),
    },
  ];

  return (
    <>
      <ResourcePage<DocumentRecord>
        title="Invoices"
        description="Issued invoices, payment status and outstanding balances."
        endpoint="/invoices"
        createLabel="New invoice"
        searchPlaceholder="Search by invoice number…"
        canCreate={can(PERMISSIONS.INVOICES_WRITE)}
        canEdit={can(PERMISSIONS.INVOICES_WRITE)}
        canDelete={can(PERMISSIONS.INVOICES_DELETE)}
        extraParams={status ? { status } : undefined}
        emptyDescription="Create an invoice from an order or from scratch to bill a customer."
        deleteDescription={(invoice) =>
          `${invoice.number} will be removed. Only draft or void invoices can be deleted.`
        }
        onRowClick={(invoice) => setViewing(invoice)}
        rowActions={rowActions}
        toolbar={
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-8 rounded-md border border-input bg-card px-2.5 text-xs"
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {['draft', 'sent', 'partial', 'paid', 'overdue', 'void'].map((value) => (
              <option key={value} value={value} className="capitalize">
                {value}
              </option>
            ))}
          </select>
        }
        columns={[
          {
            key: 'number',
            header: 'Invoice',
            cell: (invoice) => (
              <div>
                <p className="font-medium">{invoice.number}</p>
                <p className="text-[11px] text-muted-foreground">
                  Issued {formatDate(invoice.issueDate)} · due {formatDate(invoice.dueDate)}
                </p>
              </div>
            ),
          },
          {
            key: 'customer',
            header: 'Customer',
            cell: (invoice) => <span className="text-muted-foreground">{refName(invoice.customer)}</span>,
          },
          {
            key: 'total',
            header: 'Total',
            align: 'right',
            cell: (invoice) => <span className="font-medium">{formatCurrency(invoice.total, currency)}</span>,
          },
          {
            key: 'balance',
            header: 'Balance',
            align: 'right',
            cell: (invoice) => (
              <span className={invoice.balance && invoice.balance > 0 ? 'font-medium text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}>
                {formatCurrency(invoice.balance ?? 0, currency)}
              </span>
            ),
          },
          { key: 'status', header: 'Status', cell: (invoice) => <StatusBadge status={invoice.status} /> },
        ]}
        renderForm={({ record, open, onOpenChange }) => (
          <DocumentFormDialog kind="invoice" record={record} open={open} onOpenChange={onOpenChange} />
        )}
      />

      <DocumentViewDialog
        kind="invoice"
        record={viewing}
        open={Boolean(viewing)}
        onOpenChange={(open) => !open && setViewing(null)}
        actions={
          viewing ? (
            <>
              <button
                type="button"
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-input bg-card px-4 text-sm font-medium hover:bg-accent"
                onClick={() => void downloadDocument(`/invoices/${viewing.id}/pdf`, `${viewing.number}.pdf`)}
              >
                <Download className="size-4" />
                PDF
              </button>
              {viewing.status === 'draft' && can(PERMISSIONS.INVOICES_WRITE) && (
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  onClick={() => {
                    setIssuing(viewing);
                    setViewing(null);
                  }}
                >
                  <Send className="size-4" />
                  Issue invoice
                </button>
              )}
              {!['void', 'draft', 'paid'].includes(viewing.status) &&
                (viewing.balance ?? 0) > 0 &&
                can(PERMISSIONS.PAYMENTS_WRITE) && (
                  <button
                    type="button"
                    className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    onClick={() => {
                      setPaying(viewing);
                      setViewing(null);
                    }}
                  >
                    <CreditCard className="size-4" />
                    Record payment
                  </button>
                )}
            </>
          ) : null
        }
      />

      <ConfirmDialog
        open={Boolean(issuing)}
        onOpenChange={(open) => !open && setIssuing(null)}
        title="Issue invoice"
        description={
          issuing
            ? `${issuing.number} will be posted to the ledger and stock will be issued for tracked products.`
            : undefined
        }
        confirmLabel="Issue invoice"
        destructive={false}
        loading={action.isPending}
        onConfirm={async () => {
          if (!issuing) return;
          try {
            await action.mutateAsync({ id: issuing.id, action: 'issue' });
            notifySuccess('Invoice issued');
            setIssuing(null);
          } catch {
            // Errors are surfaced by the mutation hook.
          }
        }}
      />

      <PromptDialog
        open={Boolean(voiding)}
        onOpenChange={(open) => !open && setVoiding(null)}
        title="Void invoice"
        description={
          voiding
            ? `${voiding.number} will be voided, stock restored and reversing journals posted. This cannot be undone.`
            : undefined
        }
        label="Reason for voiding"
        placeholder="Explain why this invoice is being voided…"
        confirmLabel="Void invoice"
        loading={voidInvoice.isPending}
        onConfirm={async (reason) => {
          if (!voiding) return;
          try {
            await voidInvoice.mutateAsync({ id: voiding.id, action: 'void', payload: { reason } });
            notifySuccess('Invoice voided');
            setVoiding(null);
          } catch {
            // Errors are surfaced by the mutation hook.
          }
        }}
      />

      <PaymentDialog
        open={Boolean(paying)}
        onOpenChange={(open) => !open && setPaying(null)}
        defaultInvoiceId={paying?.id}
      />
    </>
  );
}
