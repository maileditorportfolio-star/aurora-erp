'use client';

import { useState } from 'react';
import { Download, Eye, FileInput } from 'lucide-react';
import { ResourcePage } from '@/components/crud/resource-page';
import { ConfirmDialog } from '@/components/data/confirm-dialog';
import type { RowActionItem } from '@/components/data/row-actions';
import { DocumentFormDialog } from '@/components/documents/document-form';
import { DocumentViewDialog } from '@/components/documents/document-view';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { useResourceAction, notifySuccess } from '@/hooks/use-resource';
import { downloadDocument } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { PERMISSIONS } from '@/lib/permissions';
import { refName } from '@/lib/utils';
import type { DocumentRecord } from '@/lib/types';

export default function QuotationsPage() {
  const { can, activeOrganization } = useAuth();
  const currency = activeOrganization?.settings?.currency || 'USD';
  const [viewing, setViewing] = useState<DocumentRecord | null>(null);
  const [converting, setConverting] = useState<DocumentRecord | null>(null);
  const [status, setStatus] = useState('');

  const convert = useResourceAction<DocumentRecord>('/quotations', ['/sales-orders']);

  const rowActions = (quotation: DocumentRecord): RowActionItem[] => [
    {
      label: 'View details',
      icon: Eye,
      onSelect: () => setViewing(quotation),
    },
    {
      label: 'Download PDF',
      icon: Download,
      onSelect: () =>
        void downloadDocument(`/quotations/${quotation.id}/pdf`, `${quotation.number}.pdf`),
    },
    {
      label: 'Convert to sales order',
      icon: FileInput,
      hidden: ['converted', 'rejected', 'expired'].includes(quotation.status),
      disabled: !can(PERMISSIONS.SALES_ORDERS_WRITE),
      separatorBefore: true,
      onSelect: () => setConverting(quotation),
    },
  ];

  return (
    <>
      <ResourcePage<DocumentRecord>
        title="Quotations"
        description="Price proposals sent to customers, ready to convert into orders."
        endpoint="/quotations"
        createLabel="New quotation"
        searchPlaceholder="Search by quotation number…"
        canCreate={can(PERMISSIONS.QUOTATIONS_WRITE)}
        canEdit={can(PERMISSIONS.QUOTATIONS_WRITE)}
        canDelete={can(PERMISSIONS.QUOTATIONS_DELETE)}
        extraParams={status ? { status } : undefined}
        emptyDescription="Create a quotation to start the sales cycle."
        deleteDescription={(quotation) => `${quotation.number} will be removed from active lists.`}
        onRowClick={(quotation) => setViewing(quotation)}
        rowActions={rowActions}
        toolbar={
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-8 rounded-md border border-input bg-card px-2.5 text-xs"
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted'].map((value) => (
              <option key={value} value={value} className="capitalize">
                {value}
              </option>
            ))}
          </select>
        }
        columns={[
          {
            key: 'number',
            header: 'Quotation',
            cell: (quotation) => (
              <div>
                <p className="font-medium">{quotation.number}</p>
                <p className="text-[11px] text-muted-foreground">
                  {formatDate(quotation.date)} · valid until {formatDate(quotation.validUntil)}
                </p>
              </div>
            ),
          },
          {
            key: 'customer',
            header: 'Customer',
            cell: (quotation) => <span className="text-muted-foreground">{refName(quotation.customer)}</span>,
          },
          {
            key: 'total',
            header: 'Total',
            align: 'right',
            cell: (quotation) => <span className="font-medium">{formatCurrency(quotation.total, currency)}</span>,
          },
          { key: 'status', header: 'Status', cell: (quotation) => <StatusBadge status={quotation.status} /> },
        ]}
        renderForm={({ record, open, onOpenChange }) => (
          <DocumentFormDialog kind="quotation" record={record} open={open} onOpenChange={onOpenChange} />
        )}
      />

      <DocumentViewDialog
        kind="quotation"
        record={viewing}
        open={Boolean(viewing)}
        onOpenChange={(open) => !open && setViewing(null)}
        actions={
          viewing ? (
            <>
              <Button
                variant="outline"
                onClick={() => void downloadDocument(`/quotations/${viewing.id}/pdf`, `${viewing.number}.pdf`)}
              >
                <Download />
                PDF
              </Button>
              {!['converted', 'rejected', 'expired'].includes(viewing.status) && (
                <Button
                  disabled={!can(PERMISSIONS.SALES_ORDERS_WRITE)}
                  onClick={() => {
                    setConverting(viewing);
                    setViewing(null);
                  }}
                >
                  <FileInput />
                  Convert to order
                </Button>
              )}
            </>
          ) : null
        }
      />

      <ConfirmDialog
        open={Boolean(converting)}
        onOpenChange={(open) => !open && setConverting(null)}
        title="Convert quotation"
        description={
          converting
            ? `${converting.number} will become a sales order using the same line items and customer.`
            : undefined
        }
        confirmLabel="Convert"
        destructive={false}
        loading={convert.isPending}
        onConfirm={async () => {
          if (!converting) return;
          try {
            const order = await convert.mutateAsync({ id: converting.id, action: 'convert' });
            notifySuccess(`Sales order ${order?.number ?? 'created'} from quotation`);
            setConverting(null);
          } catch {
            // Errors are surfaced by the mutation hook.
          }
        }}
      />
    </>
  );
}
