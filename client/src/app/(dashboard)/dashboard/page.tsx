'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  Boxes,
  CircleDollarSign,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/layout/stat-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import {
  formatCompactCurrency,
  formatCurrency,
  formatDate,
  formatNumber,
  formatRelative,
  humanize,
} from '@/lib/formatters';
import type { DashboardData } from '@/lib/types';

const CHART_COLORS = {
  primary: '#6366f1',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  sky: '#0ea5e9',
};

function ChartTooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-foreground">{label}</p>
      {payload.map((item) => (
        <p key={item.name} className="flex items-center gap-1.5 text-muted-foreground">
          <span className="size-1.5 rounded-full" style={{ background: item.color }} />
          {humanize(item.name)}:{' '}
          <span className="font-medium text-foreground">{formatCurrency(item.value ?? 0)}</span>
        </p>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { user, activeOrganization } = useAuth();
  const currency = activeOrganization?.settings?.currency || 'USD';
  const { data, isLoading, isError, refetch } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => api.get<DashboardData>('/dashboard'),
  });

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-16 w-full" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-80 lg:col-span-2" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-4">
        <PageHeader title="Dashboard" description="Live performance across your workspace." />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <AlertTriangle className="size-7 text-amber-500" />
            <div>
              <p className="text-sm font-semibold">We couldn&apos;t load your dashboard</p>
              <p className="text-xs text-muted-foreground">
                Check that the API is running, then try again.
              </p>
            </div>
            <Button variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { metrics, changes } = data;
  const funnelMax = Math.max(...data.salesFunnel.map((stage) => stage.value), 1);
  const firstName = user?.name?.split(' ')[0] ?? 'there';

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Good to see you, ${firstName}`}
        description={`Here is how ${activeOrganization?.name ?? 'your workspace'} is performing this month.`}
        actions={
          <Button variant="outline" asChild>
            <Link href="/finance/reports">
              View reports
              <ArrowUpRight />
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Revenue this month"
          value={formatCurrency(metrics.revenue, currency)}
          change={changes.revenue}
          icon={TrendingUp}
          tone="success"
        />
        <StatCard
          label="Expenses this month"
          value={formatCurrency(metrics.expenses, currency)}
          change={changes.expenses}
          icon={TrendingDown}
          tone="warning"
        />
        <StatCard
          label="Net profit"
          value={formatCurrency(metrics.profit, currency)}
          change={changes.profit}
          icon={CircleDollarSign}
          tone="primary"
        />
        <StatCard
          label="Cash position"
          value={formatCurrency(metrics.cashBalance, currency)}
          icon={Wallet}
          hint="Cashflow net this year"
          tone="sky"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Receivables" value={formatCurrency(metrics.receivables, currency)} icon={Banknote} hint={`${metrics.overdueInvoices} overdue invoices`} tone="primary" />
        <StatCard label="Payables" value={formatCurrency(metrics.payables, currency)} icon={Wallet} hint="Outstanding vendor bills" tone="warning" />
        <StatCard label="Active customers" value={formatNumber(metrics.activeCustomers)} icon={Users} hint={`${changes.customersNew} new this month`} tone="success" />
        <StatCard label="Pending orders" value={formatNumber(metrics.pendingOrders)} icon={ShoppingCart} hint={`${changes.ordersNew} created this month`} tone="sky" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle>Revenue vs expenses</CardTitle>
              <CardDescription>Monthly performance for the trailing 12 months</CardDescription>
            </div>
            <Badge variant="outline">Trailing 12M</Badge>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.monthlyFinancials} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.warning} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={CHART_COLORS.warning} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickFormatter={(value) => formatCompactCurrency(Number(value), currency)} width={64} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area type="monotone" dataKey="revenue" stroke={CHART_COLORS.primary} strokeWidth={2} fill="url(#revenueFill)" />
                  <Area type="monotone" dataKey="expenses" stroke={CHART_COLORS.warning} strokeWidth={2} fill="url(#expenseFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sales funnel</CardTitle>
            <CardDescription>Quotation-to-cash conversion</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.salesFunnel.map((stage, index) => {
              const colors = [CHART_COLORS.sky, CHART_COLORS.primary, CHART_COLORS.warning, CHART_COLORS.success, '#8b5cf6'];
              return (
                <div key={stage.stage} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{stage.stage}</span>
                    <span className="font-semibold">{formatNumber(stage.value)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.max((stage.value / funnelMax) * 100, stage.value > 0 ? 6 : 0)}%`,
                        background: colors[index % colors.length],
                      }}
                    />
                  </div>
                </div>
              );
            })}
            <div className="border-t border-border/70 pt-3 text-[11px] text-muted-foreground">
              {formatNumber(metrics.inventoryAlerts)} inventory alerts need attention.
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Cashflow</CardTitle>
            <CardDescription>Inflows and outflows by month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.cashflow} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickFormatter={(value) => formatCompactCurrency(Number(value), currency)} width={64} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="inflow" fill={CHART_COLORS.success} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="outflow" fill={CHART_COLORS.danger} radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Low stock</CardTitle>
            <CardDescription>Items at or below reorder point</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.lowStock.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Boxes className="size-6 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Inventory is healthy.</p>
              </div>
            ) : (
              data.lowStock.slice(0, 5).map((product) => (
                <div key={product.id} className="flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{product.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {product.sku} · {product.category ?? 'Uncategorised'}
                    </p>
                  </div>
                  <Badge variant="warning">
                    {formatNumber(product.stock)} / {formatNumber(product.reorderPoint)}
                  </Badge>
                </div>
              ))
            )}
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link href="/inventory/stock">Manage inventory</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle>Recent invoices</CardTitle>
              <CardDescription>Latest issued invoices and balances</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/sales/invoices">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 font-semibold">Invoice</th>
                  <th className="pb-2 font-semibold">Customer</th>
                  <th className="pb-2 font-semibold">Due</th>
                  <th className="pb-2 text-right font-semibold">Total</th>
                  <th className="pb-2 text-right font-semibold">Due amount</th>
                  <th className="pb-2 text-right font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recentInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                      No invoices yet. Create your first invoice from the sales module.
                    </td>
                  </tr>
                ) : (
                  data.recentInvoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 font-medium">{invoice.number}</td>
                      <td className="max-w-32 truncate py-2.5 text-muted-foreground">{invoice.customer}</td>
                      <td className="py-2.5 text-muted-foreground">{formatDate(invoice.dueDate)}</td>
                      <td className="py-2.5 text-right">{formatCurrency(invoice.total, currency)}</td>
                      <td className="py-2.5 text-right">{formatCurrency(invoice.balance, currency)}</td>
                      <td className="py-2.5 text-right">
                        <StatusBadge status={invoice.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top products</CardTitle>
            <CardDescription>By invoiced revenue</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.topProducts.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">No sales recorded yet.</p>
            ) : (
              data.topProducts.map((product, index) => (
                <div key={`${product.sku}-${index}`} className="flex items-center gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-muted text-[10px] font-semibold text-muted-foreground">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{product.name}</p>
                    <p className="text-[11px] text-muted-foreground">{formatNumber(product.quantity)} sold</p>
                  </div>
                  <span className="text-xs font-semibold">{formatCurrency(product.revenue, currency)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-start justify-between">
          <div>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Audit trail across the workspace</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/settings/audit">Audit log</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.recentActivity.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Activity will appear here.</p>
          ) : (
            data.recentActivity.map((entry) => (
              <div key={entry.id} className="flex items-start justify-between gap-3 border-b border-border/50 pb-2.5 last:border-0 last:pb-0">
                <div className="flex min-w-0 gap-2.5">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                  <div className="min-w-0">
                    <p className="truncate text-xs">
                      <span className="font-medium">{entry.actor ?? 'System'}</span>{' '}
                      <span className="text-muted-foreground">{entry.action}</span>{' '}
                      <span className="font-medium">{entry.resource}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">{formatRelative(entry.createdAt)}</p>
                  </div>
                </div>
                {entry.statusCode && <Badge variant="outline">{entry.statusCode}</Badge>}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
