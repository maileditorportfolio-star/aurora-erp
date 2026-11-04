export interface ReportAccount {
  accountId: string;
  code: string;
  name: string;
  type: string;
  subtype?: string;
  amount: number;
}

export interface ProfitLossReport {
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

export interface TrialBalanceReport {
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

export interface BalanceSheetReport {
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

export interface CashflowReport {
  period: { from: string; to: string };
  monthly: Array<{ month: string; inflow: number; outflow: number; net: number }>;
  totals: { inflow: number; outflow: number; net: number };
}

export interface AgingRow {
  id: string;
  number: string;
  customer?: string;
  supplier?: string;
  dueDate: string;
  daysOverdue: number;
  balance: number;
  bucket: string;
}

export interface AgingReport {
  rows: AgingRow[];
  buckets: Record<string, number>;
  total: number;
}

export interface SummaryReport {
  period: { from: string; to: string };
  profitLoss: ProfitLossReport['totals'];
  balanceSheet: BalanceSheetReport['totals'];
  cashflow: CashflowReport['totals'];
  monthly: ProfitLossReport['monthly'];
}

export const BUCKETS = [
  { key: 'current', label: 'Current' },
  { key: 'days1to30', label: '1–30 days' },
  { key: 'days31to60', label: '31–60 days' },
  { key: 'days61to90', label: '61–90 days' },
  { key: 'over90', label: '90+ days' },
];

export function startOfYear() {
  const date = new Date();
  return `${date.getFullYear()}-01-01`;
}
