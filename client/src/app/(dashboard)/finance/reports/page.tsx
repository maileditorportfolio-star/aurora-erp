'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, Download, Printer, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/data/data-table';
import { PageHeader } from '@/components/layout/page-header';
import { useAuth } from '@/hooks/use-auth';
import { api, buildQuery } from '@/lib/api';
import { formatCurrency, formatDate, formatPercent, toDateInput } from '@/lib/formatters';

interface ReportAccount {
  accountId: string;
  code: string;
  name: string;
  type: string;
  subtype?: string;
  amount: number;
}

interface ProfitLossReport {
  period: { from: string; to: string };
  revenue: ReportAccount[];
  expenses: ReportAccount[];
  monthly: Array<{ month: string; revenue: number; expenses: number; profit: number }>;
  totals: {
    revenue: number;
    expenses: number;
    cogs: number;
    operatingExpenses: number;
    grossProfit: number;
    netProfit: number;
    margin: number;
  };
}

interface TrialBalanceReport {
  period: { from: string; to: string };
  accounts: Array<{
    accountId: string;
    code: string;
    name: string;
    type: string;
    debit: number;
    credit: number;
    balance: number;
  }>;
  totals: { debit: number; credit: number };
}

interface BalanceSheetReport {
  asOf: string;
  assets: ReportAccount[];
  liabilities: ReportAccount[];
  equity: ReportAccount[];
  totals: {
    assets: number;
    liabilities: number;
    equity: number;
    netIncome: number;
    liabilitiesAndEquity: number;
    balanced: boolean;
  };
}

interface CashflowReport {
  period: { from: string; to: string };
  monthly: Array<{ month: string; inflow: number; outflow: number; net: number }>;
  totals: { inflow: number; outflow: number; net: number };
}

interface AgingRow {
  id: string;
  number: string;
  customer?: string;
  supplier?: string;
  dueDate: string;
  daysOverdue: number;
  balance: number;
  bucket: string;
}

interface AgingReport {
  rows: AgingRow[];
  buckets: Record<string, number>;
  total: number;
}

interface SummaryReport {
  period: { from: string; to: string };
  profitLoss: ProfitLossReport['totals'];
  balanceSheet: BalanceSheetReport['totals'];
  cashflow: CashflowReport['totals'];
  monthly: ProfitLossReport['monthly'];
}

const BUCKETS = [
  { key: 'current', label: 'Current' },
  { key: 'days1to30', label: '1–30 days' },
  { key: 'days31to60', label: '31–60 days' },
  { key: 'days61to90', label: '61–90 days' },
  { key: 'over90', label: '90+ days' },
];

function startOfYear() {
  const date = new Date();
  return `${date.getFullYear()}-01-01`;
}

export default function ReportsPage() {
  const { activeOrganization } = useAuth();
  const currency = activeOrganization?.settings?.currency || 'USD';
  const [tab, setTab] = useState('overview');
  const [from, setFrom] = useState(startOfYear());
  const [to, setTo] = useState(toDateInput(new Date()));

  const range = buildQuery({ from: from || undefined, to: to || undefined });

  const summary = useQuery<SummaryReport>({
    queryKey: ['/reports', 'summary', from, to],
    queryFn: () => api.get<SummaryReport>(`/reports/summary${range}`),
  });

  const profitLoss = useQuery<ProfitLossReport>({
    queryKey: ['/reports', 'profit-loss', from, to],
    queryFn: () => api.get<ProfitLossReport>(`/reports/profit-loss${range}`),
    enabled: tab === 'profit-loss',
  });

  const trial = useQuery<TrialBalanceReport>({
    queryKey: ['/reports', 'trial-balance', from, to],
    queryFn: () => api.get<TrialBalanceReport>(`/reports/trial-balance${range}`),
    enabled: tab === 'trial-balance',
  });

  const balance = useQuery<BalanceSheetReport>({
    queryKey: ['/reports', 'balance-sheet', from, to],
    queryFn: () => api.get<BalanceSheetReport>(`/reports/balance-sheet${range}`),
    enabled: tab === 'balance-sheet',
  });

  const cashflow = useQuery<CashflowReport>({
    queryKey: ['/reports', 'cashflow', from, to],
    queryFn: () => api.get<CashflowReport>(`/reports/cashflow${range}`),
    enabled: tab === 'cashflow',
  });

  const receivables = useQuery<AgingReport>({
    queryKey: ['/reports', 'receivables-aging'],
    queryFn: () => api.get<AgingReport>('/reports/receivables-aging'),
    enabled: tab === 'aging',
  });

  const payables = useQuery<AgingReport>({
    queryKey: ['/reports', 'payables-aging'],
    queryFn: () => api.get<AgingReport>('/reports/payables-aging'),
    enabled: tab === 'aging',
  });

  const chartData = useMemo(
    () =>
      (summary.data?.monthly ?? []).map((month) => ({
        ...month,
        label: new Date(`${month.month}-01T00:00:00Z`).toLocaleDateString('en-US', {
          month: 'short',
          year: '2-digit',
        }),
      })),
    [summary.data?.monthly],
  );

  const lastUpdated = summary.dataUpdatedAt ? new Date(summary.dataUpdatedAt) : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Financial reports"
        description="Real-time profit and loss, trial balance, balance sheet, cash flow and aging analysis."
        actions={
          <>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer />
              Print
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                void summary.refetch();
                if (tab === 'profit-loss') void profitLoss.refetch();
                if (tab === 'trial-balance') void trial.refetch();
                if (tab === 'balance-sheet') void balance.refetch();
                if (tab === 'cashflow') void cashflow.refetch();
                if (tab === 'aging') {
                  void receivables.refetch();
                  void payables.refetch();
                }
              }}
            >
              <RefreshCw />
              Refresh
            </Button>
          </>
        }
      />

      <Card className="flex flex-col gap-3 p-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="report-from" className="mb-1 block text-[11px] font-medium text-muted-foreground">
              From
            </label>
            <Input
              id="report-from"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="w-40"
            />
          </div>
          <div>
            <label htmlFor="report-to" className="mb-1 block text-[11px] font-medium text-muted-foreground">
              To
            </label>
            <Input
              id="report-to"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="w-40"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => {
              const now = new Date();
              setFrom(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`);
              setTo(toDateInput(now));
            }}
          >
            This month
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const now = new Date();
              const quarter = Math.floor(now.getMonth() / 3) * 3;
              const start = new Date(now.getFullYear(), quarter, 1);
              setFrom(toDateInput(start));
              setTo(toDateInput(now));
            }}
          >
            This quarter
          </Button>
          <Button variant="outline" onClick={() => { setFrom(startOfYear()); setTo(toDateInput(new Date())); }}>
            This year
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {from || 'Beginning'} → {to || 'Today'}
          {lastUpdated ? ` · updated ${formatDate(lastUpdated, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : ''}
        </p>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="profit-loss">Profit &amp; loss</TabsTrigger>
          <TabsTrigger value="trial-balance">Trial balance</TabsTrigger>
          <TabsTrigger value="balance-sheet">Balance sheet</TabsTrigger>
          <TabsTrigger value="cashflow">Cash flow</TabsTrigger>
          <TabsTrigger value="aging">Aging</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {summary.isLoading ? (
            <LoadingBlock />
          ) : summary.isError ? (
            <ErrorBlock />
          ) : summary.data ? (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <ReportKpi label="Revenue" value={formatCurrency(summary.data.profitLoss.revenue, currency)} tone="positive" />
                <ReportKpi label="Expenses" value={formatCurrency(summary.data.profitLoss.expenses, currency)} tone="negative" />
                <ReportKpi
                  label="Net profit"
                  value={formatCurrency(summary.data.profitLoss.netProfit, currency)}
                  hint={`${formatPercent(summary.data.profitLoss.margin)} margin`}
                  tone={summary.data.profitLoss.netProfit >= 0 ? 'positive' : 'negative'}
                />
                <ReportKpi
                  label="Cash position"
                  value={formatCurrency(summary.data.cashflow.net, currency)}
                  hint="Net cash movement"
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="p-5 lg:col-span-2">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">Revenue vs expenses</p>
                      <p className="text-[11px] text-muted-foreground">Monthly posted activity</p>
                    </div>
                    <BarChart3 className="size-4 text-muted-foreground" />
                  </div>
                  {chartData.length ? (
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} barGap={4}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                          <XAxis dataKey="label" axisLine={false} tickLine={false} fontSize={11} />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            fontSize={11}
                            tickFormatter={(value: number) => compact(value)}
                          />
                          <RechartsTooltip
                            formatter={(value) => formatCurrency(Number(value), currency)}
                            contentStyle={{ borderRadius: 10, borderColor: 'hsl(var(--border))', fontSize: 12 }}
                          />
                          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                          <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={24} />
                          <Bar dataKey="expenses" name="Expenses" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={24} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <EmptyReport message="No posted activity in this period." />
                  )}
                </Card>

                <Card className="p-5">
                  <p className="text-sm font-semibold">Balance sheet snapshot</p>
                  <p className="text-[11px] text-muted-foreground">As of {formatDate(summary.data.period.to)}</p>
                  <div className="mt-4 space-y-3 text-sm">
                    <SummaryRow label="Total assets" value={formatCurrency(summary.data.balanceSheet.assets, currency)} />
                    <SummaryRow label="Total liabilities" value={formatCurrency(summary.data.balanceSheet.liabilities, currency)} />
                    <SummaryRow label="Total equity" value={formatCurrency(summary.data.balanceSheet.equity, currency)} />
                    <div className="border-t border-border/70 pt-3">
                      <SummaryRow
                        label="Liabilities + equity"
                        value={formatCurrency(summary.data.balanceSheet.liabilitiesAndEquity, currency)}
                        strong
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[11px] text-muted-foreground">Reconciliation</span>
                      <StatusBadge status={summary.data.balanceSheet.balanced ? 'balanced' : 'unbalanced'} />
                    </div>
                  </div>
                </Card>
              </div>

              <Card className="overflow-hidden">
                <div className="border-b border-border/70 p-4">
                  <p className="text-sm font-semibold">Monthly performance</p>
                  <p className="text-[11px] text-muted-foreground">Revenue, expenses and profit by month</p>
                </div>
                <DataTable
                  columns={[
                    { key: 'month', header: 'Month', cell: (row) => formatMonth(row.month) },
                    {
                      key: 'revenue',
                      header: 'Revenue',
                      align: 'right',
                      cell: (row) => formatCurrency(row.revenue, currency),
                    },
                    {
                      key: 'expenses',
                      header: 'Expenses',
                      align: 'right',
                      cell: (row) => formatCurrency(row.expenses, currency),
                    },
                    {
                      key: 'profit',
                      header: 'Profit',
                      align: 'right',
                      cell: (row) => (
                        <span className={row.profit >= 0 ? 'font-medium text-emerald-600 dark:text-emerald-400' : 'font-medium text-destructive'}>
                          {formatCurrency(row.profit, currency)}
                        </span>
                      ),
                    },
                  ]}
                  rows={summary.data.monthly.map((month) => ({ id: month.month, ...month }))}
                  emptyTitle="No monthly activity"
                  emptyDescription="Post invoices, payments or transactions to populate this report."
                />
              </Card>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="profit-loss">
          {profitLoss.isLoading ? (
            <LoadingBlock />
          ) : profitLoss.data ? (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <ReportKpi label="Revenue" value={formatCurrency(profitLoss.data.totals.revenue, currency)} tone="positive" />
                <ReportKpi label="Cost of sales" value={formatCurrency(profitLoss.data.totals.cogs, currency)} />
                <ReportKpi label="Gross profit" value={formatCurrency(profitLoss.data.totals.grossProfit, currency)} />
                <ReportKpi
                  label="Net profit"
                  value={formatCurrency(profitLoss.data.totals.netProfit, currency)}
                  hint={`${formatPercent(profitLoss.data.totals.margin)} margin`}
                  tone={profitLoss.data.totals.netProfit >= 0 ? 'positive' : 'negative'}
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <AccountTable title="Revenue" accounts={profitLoss.data.revenue} total={profitLoss.data.totals.revenue} currency={currency} />
                <AccountTable title="Expenses" accounts={profitLoss.data.expenses} total={profitLoss.data.totals.expenses} currency={currency} />
              </div>
            </div>
          ) : (
            <ErrorBlock />
          )}
        </TabsContent>

        <TabsContent value="trial-balance">
          {trial.isLoading ? (
            <LoadingBlock />
          ) : trial.data ? (
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 p-4">
                <div>
                  <p className="text-sm font-semibold">Trial balance</p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatDate(trial.data.period.from)} – {formatDate(trial.data.period.to)}
                  </p>
                </div>
                <div className="flex gap-4 text-xs">
                  <span>
                    Debits <span className="font-semibold">{formatCurrency(trial.data.totals.debit, currency)}</span>
                  </span>
                  <span>
                    Credits <span className="font-semibold">{formatCurrency(trial.data.totals.credit, currency)}</span>
                  </span>
                </div>
              </div>
              <DataTable
                columns={[
                  {
                    key: 'account',
                    header: 'Account',
                    cell: (row) => (
                      <div>
                        <p className="font-medium">{row.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {row.code} · {row.type}
                        </p>
                      </div>
                    ),
                  },
                  { key: 'debit', header: 'Debit', align: 'right', cell: (row) => formatCurrency(row.debit, currency) },
                  { key: 'credit', header: 'Credit', align: 'right', cell: (row) => formatCurrency(row.credit, currency) },
                  {
                    key: 'balance',
                    header: 'Balance',
                    align: 'right',
                    cell: (row) => (
                      <span className="font-medium">{formatCurrency(Math.abs(row.balance), currency)}</span>
                    ),
                  },
                ]}
                rows={trial.data.accounts.map((account) => ({ id: account.accountId, ...account }))}
                emptyTitle="No trial balance rows"
                emptyDescription="There are no posted journal entries in this period."
              />
            </Card>
          ) : (
            <ErrorBlock />
          )}
        </TabsContent>

        <TabsContent value="balance-sheet">
          {balance.isLoading ? (
            <LoadingBlock />
          ) : balance.data ? (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <ReportKpi label="Assets" value={formatCurrency(balance.data.totals.assets, currency)} />
                <ReportKpi label="Liabilities" value={formatCurrency(balance.data.totals.liabilities, currency)} />
                <ReportKpi label="Equity" value={formatCurrency(balance.data.totals.equity, currency)} />
                <ReportKpi
                  label="Liabilities + equity"
                  value={formatCurrency(balance.data.totals.liabilitiesAndEquity, currency)}
                  hint={balance.data.totals.balanced ? 'Balanced' : 'Out of balance'}
                  tone={balance.data.totals.balanced ? 'positive' : 'negative'}
                />
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                <AccountTable title="Assets" accounts={balance.data.assets} total={balance.data.totals.assets} currency={currency} />
                <AccountTable title="Liabilities" accounts={balance.data.liabilities} total={balance.data.totals.liabilities} currency={currency} />
                <AccountTable title="Equity" accounts={balance.data.equity} total={balance.data.totals.equity} currency={currency} />
              </div>
            </div>
          ) : (
            <ErrorBlock />
          )}
        </TabsContent>

        <TabsContent value="cashflow">
          {cashflow.isLoading ? (
            <LoadingBlock />
          ) : cashflow.data ? (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <ReportKpi label="Cash inflow" value={formatCurrency(cashflow.data.totals.inflow, currency)} tone="positive" />
                <ReportKpi label="Cash outflow" value={formatCurrency(cashflow.data.totals.outflow, currency)} tone="negative" />
                <ReportKpi
                  label="Net cash flow"
                  value={formatCurrency(cashflow.data.totals.net, currency)}
                  tone={cashflow.data.totals.net >= 0 ? 'positive' : 'negative'}
                />
              </div>
              <Card className="overflow-hidden">
                <div className="border-b border-border/70 p-4">
                  <p className="text-sm font-semibold">Monthly cash flow</p>
                  <p className="text-[11px] text-muted-foreground">Receipts, payments, income and expenses</p>
                </div>
                <DataTable
                  columns={[
                    { key: 'month', header: 'Month', cell: (row) => formatMonth(row.month) },
                    { key: 'inflow', header: 'Inflow', align: 'right', cell: (row) => formatCurrency(row.inflow, currency) },
                    { key: 'outflow', header: 'Outflow', align: 'right', cell: (row) => formatCurrency(row.outflow, currency) },
                    {
                      key: 'net',
                      header: 'Net',
                      align: 'right',
                      cell: (row) => (
                        <span className={row.net >= 0 ? 'font-medium text-emerald-600 dark:text-emerald-400' : 'font-medium text-destructive'}>
                          {formatCurrency(row.net, currency)}
                        </span>
                      ),
                    },
                  ]}
                  rows={cashflow.data.monthly.map((month) => ({ id: month.month, ...month }))}
                  emptyTitle="No cash movement"
                  emptyDescription="Record payments or transactions to see cash flow."
                />
              </Card>
            </div>
          ) : (
            <ErrorBlock />
          )}
        </TabsContent>

        <TabsContent value="aging">
          {receivables.isLoading || payables.isLoading ? (
            <LoadingBlock />
          ) : (
            <div className="space-y-6">
              <AgingSection
                title="Accounts receivable aging"
                report={receivables.data}
                party="customer"
                currency={currency}
              />
              <AgingSection
                title="Accounts payable aging"
                report={payables.data}
                party="supplier"
                currency={currency}
              />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReportKpi({
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

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={strong ? 'font-medium' : 'text-muted-foreground'}>{label}</span>
      <span className={strong ? 'font-semibold' : 'font-medium'}>{value}</span>
    </div>
  );
}

function AccountTable({
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

function AgingSection({
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

function bucketLabel(bucket: string) {
  return BUCKETS.find((entry) => entry.key === bucket)?.label ?? bucket;
}

function formatMonth(value: string) {
  const date = new Date(`${value}-01T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function compact(value: number) {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function LoadingBlock() {
  return (
    <Card className="p-10 text-center text-sm text-muted-foreground">
      <RefreshCw className="mx-auto mb-2 size-5 animate-spin" />
      Building report…
    </Card>
  );
}

function ErrorBlock() {
  return (
    <Card className="p-10 text-center text-sm text-muted-foreground">
      <Download className="mx-auto mb-2 size-5" />
      Unable to load this report. Please refresh and try again.
    </Card>
  );
}

function EmptyReport({ message }: { message: string }) {
  return <div className="grid h-72 place-items-center text-xs text-muted-foreground">{message}</div>;
}
