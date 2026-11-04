'use client';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Printer, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/layout/page-header';
import { useAuth } from '@/hooks/use-auth';
import { api, buildQuery } from '@/lib/api';
import { formatDate, toDateInput } from '@/lib/formatters';
import type { AgingReport, BalanceSheetReport, CashflowReport, ProfitLossReport, SummaryReport, TrialBalanceReport } from '@/lib/schemas/report';
import { startOfYear } from '@/lib/schemas/report';
import { AgingSectionWrapper, BalanceSheetSection, CashflowSection, OverviewSection, ProfitLossSection, TrialBalanceSection } from '@/components/finance/report-sections';

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
          <OverviewSection summary={summary} chartData={chartData} currency={currency} />
        </TabsContent>

        <TabsContent value="profit-loss">
          <ProfitLossSection profitLoss={profitLoss} currency={currency} />
        </TabsContent>

        <TabsContent value="trial-balance">
          <TrialBalanceSection trial={trial} currency={currency} />
        </TabsContent>

        <TabsContent value="balance-sheet">
          <BalanceSheetSection balance={balance} currency={currency} />
        </TabsContent>

        <TabsContent value="cashflow">
          <CashflowSection cashflow={cashflow} currency={currency} />
        </TabsContent>

        <TabsContent value="aging">
          <AgingSectionWrapper receivables={receivables} payables={payables} currency={currency} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
