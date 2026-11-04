'use client';
import { Download, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { DataTable } from '@/components/data/data-table';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { BUCKETS, type AgingReport, type ReportAccount } from '@/lib/schemas/report';

export function ReportKpi({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'positive' | 'negative';
}) {
  const valueClass =
    tone === 'positive'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'negative'
        ? 'text-destructive'
        : 'text-foreground';
  return (
    <Card className="p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${valueClass}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </Card>
  );
}

export function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={strong ? 'font-medium' : 'text-muted-foreground'}>{label}</span>
      <span className={strong ? 'font-semibold' : 'font-medium'}>{value}</span>
    </div>
  );
}

export function AccountTable({
  title,
  accounts,
  total,
  currency,
}: {
  title: string;
  accounts: ReportAccount[];
  total: number;
  currency: string;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/70 p-4">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs font-medium">{formatCurrency(total, currency)}</p>
      </div>
      {accounts.length ? (
        <div className="divide-y divide-border/60">
          {accounts.map((account) => (
            <div key={account.accountId} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="truncate">{account.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {account.code}
                  {account.subtype ? ` · ${account.subtype.replace(/_/g, ' ')}` : ''}
                </p>
              </div>
              <span className="shrink-0 font-medium">{formatCurrency(account.amount, currency)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="px-4 py-8 text-center text-xs text-muted-foreground">No activity</p>
      )}
      <div className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-2.5 text-sm font-semibold">
        <span>Total</span>
        <span>{formatCurrency(total, currency)}</span>
      </div>
    </Card>
  );
}

export function AgingSection({
  title,
  report,
  party,
  currency,
}: {
  title: string;
  report?: AgingReport;
  party: 'customer' | 'supplier';
  currency: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="text-[11px] text-muted-foreground">
            Outstanding balance {formatCurrency(report?.total ?? 0, currency)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {BUCKETS.map((bucket) => (
            <div key={bucket.key} className="rounded-lg border border-border/80 bg-card px-3 py-1.5 text-right">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{bucket.label}</p>
              <p className="text-xs font-semibold">{formatCurrency(report?.buckets[bucket.key] ?? 0, currency)}</p>
            </div>
          ))}
        </div>
      </div>
      <Card className="overflow-hidden">
        <DataTable
          columns={[
            { key: 'number', header: 'Document', cell: (row) => <span className="font-medium">{row.number}</span> },
            { key: 'party', header: party === 'customer' ? 'Customer' : 'Vendor', cell: (row) => row[party] || '—' },
            { key: 'dueDate', header: 'Due', cell: (row) => formatDate(row.dueDate) },
            {
              key: 'days',
              header: 'Days overdue',
              align: 'right',
              cell: (row) => (row.daysOverdue > 0 ? row.daysOverdue : '—'),
            },
            { key: 'bucket', header: 'Bucket', cell: (row) => <StatusBadge status={bucketLabel(row.bucket)} /> },
            {
              key: 'balance',
              header: 'Balance',
              align: 'right',
              cell: (row) => <span className="font-medium">{formatCurrency(row.balance, currency)}</span>,
            },
          ]}
          rows={report?.rows ?? []}
          emptyTitle="Nothing outstanding"
          emptyDescription="All balances are settled for this category."
        />
      </Card>
    </div>
  );
}

export function bucketLabel(bucket: string) {
  return BUCKETS.find((entry) => entry.key === bucket)?.label ?? bucket;
}

export function formatMonth(value: string) {
  const date = new Date(`${value}-01T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function compact(value: number) {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

export function LoadingBlock() {
  return (
    <Card className="p-10 text-center text-sm text-muted-foreground">
      <RefreshCw className="mx-auto mb-2 size-5 animate-spin" />
      Building report…
    </Card>
  );
}

export function ErrorBlock() {
  return (
    <Card className="p-10 text-center text-sm text-muted-foreground">
      <Download className="mx-auto mb-2 size-5" />
      Unable to load this report. Please refresh and try again.
    </Card>
  );
}

export function EmptyReport({ message }: { message: string }) {
  return <div className="grid h-72 place-items-center text-xs text-muted-foreground">{message}</div>;
}
