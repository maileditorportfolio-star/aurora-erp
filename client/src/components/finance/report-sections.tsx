'use client';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
import { BarChart3 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { DataTable } from '@/components/data/data-table';
import { formatCurrency, formatDate, formatPercent } from '@/lib/formatters';
import type { AgingReport, BalanceSheetReport, CashflowReport, ProfitLossReport, TrialBalanceReport, SummaryReport } from '@/lib/schemas/report';
import { AccountTable, AgingSection, EmptyReport, ErrorBlock, LoadingBlock, ReportKpi, SummaryRow, compact, formatMonth } from './report-helpers';
import type { UseQueryResult } from '@tanstack/react-query';

export function OverviewSection({ summary, chartData, currency }: { summary: UseQueryResult<SummaryReport>; chartData: Array<{ month: string; revenue: number; expenses: number; profit: number; label: string }>; currency: string }) {
  return (
    <>
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
    </>
  );
}

export function ProfitLossSection({ profitLoss, currency }: { profitLoss: UseQueryResult<ProfitLossReport>; currency: string }) {
  return (
    <>
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
    </>
  );
}

export function TrialBalanceSection({ trial, currency }: { trial: UseQueryResult<TrialBalanceReport>; currency: string }) {
  return (
    <>
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
    </>
  );
}

export function BalanceSheetSection({ balance, currency }: { balance: UseQueryResult<BalanceSheetReport>; currency: string }) {
  return (
    <>
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
    </>
  );
}

export function CashflowSection({ cashflow, currency }: { cashflow: UseQueryResult<CashflowReport>; currency: string }) {
  return (
    <>
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
    </>
  );
}

export function AgingSectionWrapper({ receivables, payables, currency }: { receivables: UseQueryResult<AgingReport>; payables: UseQueryResult<AgingReport>; currency: string }) {
  return (
    <>
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
    </>
  );
}
