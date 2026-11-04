'use client';

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
import { refName } from '@/lib/utils';
import type { DocumentRecord } from '@/lib/types';
import type { DocumentKind } from './document-form';
import { DOCUMENT_CONFIG } from './document-form';

export function DocumentViewDialog({
  kind,
  record,
  open,
  onOpenChange,
  actions,
}: {
  kind: DocumentKind;
  record: DocumentRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions?: React.ReactNode;
}) {
  const { activeOrganization } = useAuth();
  const currency = activeOrganization?.settings?.currency || 'USD';
  const config = DOCUMENT_CONFIG[kind];
  if (!record) return null;

  const party = config.party === 'customer' ? record.customer : record.supplier;
  const dateLabel =
    kind === 'quotation' ? 'Quotation date' : kind === 'purchaseOrder' ? 'Order date' : 'Issue date';
  const primaryDate = record.date ?? record.issueDate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle>{record.number || config.title}</DialogTitle>
            <StatusBadge status={record.status} />
          </div>
          <DialogDescription>
            {config.title} details, line items and totals.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 rounded-xl border border-border/80 bg-muted/25 p-4 sm:grid-cols-2">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {config.party === 'customer' ? 'Customer' : 'Vendor'}
            </p>
            <p className="mt-0.5 text-sm font-semibold">{refName(party)}</p>
            {party && typeof party === 'object' && (
              <p className="text-xs text-muted-foreground">
                {[party.company, party.email].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs sm:justify-items-end">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{dateLabel}</p>
              <p className="mt-0.5 font-medium">{formatDate(primaryDate)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {kind === 'quotation' ? 'Valid until' : 'Due date'}
              </p>
              <p className="mt-0.5 font-medium">{formatDate(record.validUntil ?? record.dueDate)}</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border/80">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-semibold">Description</th>
                <th className="px-3 py-2 text-right font-semibold">Qty</th>
                <th className="px-3 py-2 text-right font-semibold">Unit price</th>
                <th className="px-3 py-2 text-right font-semibold">Disc %</th>
                <th className="px-3 py-2 text-right font-semibold">Tax %</th>
                <th className="px-3 py-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {record.items?.length ? (
                record.items.map((item, index) => (
                  <tr key={item.id ?? index} className="border-t border-border/60">
                    <td className="px-3 py-2.5">{item.description}</td>
                    <td className="px-3 py-2.5 text-right">{item.quantity}</td>
                    <td className="px-3 py-2.5 text-right">
                      {formatCurrency(item.unitPrice ?? item.unitCost ?? 0, currency)}
                    </td>
                    <td className="px-3 py-2.5 text-right">{item.discountRate ?? 0}%</td>
                    <td className="px-3 py-2.5 text-right">{item.taxRate ?? 0}%</td>
                    <td className="px-3 py-2.5 text-right font-medium">
                      {formatCurrency(item.total ?? 0, currency)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-xs text-muted-foreground">
                    No line items recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="ml-auto w-full max-w-xs space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCurrency(record.subtotal, currency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Discount</span>
            <span>−{formatCurrency(record.discountTotal, currency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tax</span>
            <span>{formatCurrency(record.taxTotal, currency)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
            <span>Total</span>
            <span>{formatCurrency(record.total, currency)}</span>
          </div>
          {typeof record.amountPaid === 'number' && (
            <>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Paid</span>
                <span>{formatCurrency(record.amountPaid, currency)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Balance</span>
                <span>{formatCurrency(record.balance ?? 0, currency)}</span>
              </div>
            </>
          )}
        </div>

        {(record.notes || record.terms) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {record.notes && (
              <div className="rounded-lg border border-border/80 p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-xs">{record.notes}</p>
              </div>
            )}
            {record.terms && (
              <div className="rounded-lg border border-border/80 p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Terms</p>
                <p className="mt-1 whitespace-pre-wrap text-xs">{record.terms}</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {actions}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
