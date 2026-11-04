import { Types } from 'mongoose';
import { JournalEntry } from '../models';
import { round2 } from '../utils/money';

export interface ReportRange {
  from: Date;
  to: Date;
}

export function parseReportRange(query: Record<string, unknown>): ReportRange {
  const now = new Date();
  const defaultFrom = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const from = query.from ? new Date(String(query.from)) : defaultFrom;
  const to = query.to ? new Date(String(query.to)) : now;
  to.setUTCHours(23, 59, 59, 999);
  return { from, to };
}

function baseMatch(organization: string, range: ReportRange) {
  return {
    organization: new Types.ObjectId(organization),
    status: 'posted',
    date: { $gte: range.from, $lte: range.to },
  };
}

export async function profitAndLoss(organization: string, range: ReportRange) {
  const rows = await JournalEntry.aggregate([
    { $match: baseMatch(organization, range) },
    { $unwind: '$lines' },
    {
      $lookup: {
        from: 'accounts',
        localField: 'lines.account',
        foreignField: '_id',
        as: 'account',
      },
    },
    { $unwind: '$account' },
    { $match: { 'account.type': { $in: ['income', 'expense'] } } },
    {
      $group: {
        _id: '$account._id',
        code: { $first: '$account.code' },
        name: { $first: '$account.name' },
        type: { $first: '$account.type' },
        subtype: { $first: '$account.subtype' },
        debit: { $sum: '$lines.debit' },
        credit: { $sum: '$lines.credit' },
      },
    },
    { $sort: { code: 1 } },
  ]);

  const accounts = rows.map((row) => ({
    accountId: String(row._id),
    code: row.code as string,
    name: row.name as string,
    type: row.type as 'income' | 'expense',
    subtype: row.subtype as string | undefined,
    amount: round2(
      row.type === 'income' ? Number(row.credit) - Number(row.debit) : Number(row.debit) - Number(row.credit),
    ),
  }));

  const revenue = accounts.filter((account) => account.type === 'income');
  const expenses = accounts.filter((account) => account.type === 'expense');
  const revenueTotal = round2(revenue.reduce((sum, account) => sum + account.amount, 0));
  const expenseTotal = round2(expenses.reduce((sum, account) => sum + account.amount, 0));
  const cogs = round2(
    expenses
      .filter((account) => account.subtype === 'cost_of_sales')
      .reduce((sum, account) => sum + account.amount, 0),
  );
  const operatingExpenses = round2(expenseTotal - cogs);
  const grossProfit = round2(revenueTotal - cogs);
  const netProfit = round2(revenueTotal - expenseTotal);

  const monthly = await JournalEntry.aggregate([
    { $match: baseMatch(organization, range) },
    { $unwind: '$lines' },
    {
      $lookup: {
        from: 'accounts',
        localField: 'lines.account',
        foreignField: '_id',
        as: 'account',
      },
    },
    { $unwind: '$account' },
    { $match: { 'account.type': { $in: ['income', 'expense'] } } },
    {
      $group: {
        _id: {
          month: { $dateToString: { format: '%Y-%m', date: '$date' } },
          type: '$account.type',
        },
        debit: { $sum: '$lines.debit' },
        credit: { $sum: '$lines.credit' },
      },
    },
    { $sort: { '_id.month': 1 } },
  ]);

  const monthMap = new Map<string, { month: string; revenue: number; expenses: number }>();
  for (const row of monthly) {
    const month = row._id.month as string;
    const entry = monthMap.get(month) ?? { month, revenue: 0, expenses: 0 };
    if (row._id.type === 'income') entry.revenue = round2(Number(row.credit) - Number(row.debit));
    else entry.expenses = round2(Number(row.debit) - Number(row.credit));
    monthMap.set(month, entry);
  }

  return {
    period: range,
    revenue,
    expenses,
    monthly: [...monthMap.values()].map((entry) => ({
      ...entry,
      profit: round2(entry.revenue - entry.expenses),
    })),
    totals: {
      revenue: revenueTotal,
      expenses: expenseTotal,
      cogs,
      operatingExpenses,
      grossProfit,
      netProfit,
      margin: revenueTotal > 0 ? round2((netProfit / revenueTotal) * 100) : 0,
    },
  };
}

export async function trialBalance(organization: string, range: ReportRange) {
  const rows = await JournalEntry.aggregate([
    { $match: baseMatch(organization, range) },
    { $unwind: '$lines' },
    {
      $group: {
        _id: '$lines.account',
        debit: { $sum: '$lines.debit' },
        credit: { $sum: '$lines.credit' },
      },
    },
    {
      $lookup: {
        from: 'accounts',
        localField: '_id',
        foreignField: '_id',
        as: 'account',
      },
    },
    { $unwind: '$account' },
    {
      $project: {
        code: '$account.code',
        name: '$account.name',
        type: '$account.type',
        debit: 1,
        credit: 1,
      },
    },
    { $sort: { code: 1 } },
  ]);

  const accounts = rows.map((row) => ({
    accountId: String(row._id),
    code: row.code as string,
    name: row.name as string,
    type: row.type as string,
    debit: round2(row.debit),
    credit: round2(row.credit),
    balance: round2(Number(row.debit) - Number(row.credit)),
  }));
  return {
    period: range,
    accounts,
    totals: {
      debit: round2(accounts.reduce((sum, account) => sum + account.debit, 0)),
      credit: round2(accounts.reduce((sum, account) => sum + account.credit, 0)),
    },
  };
}

export async function balanceSheet(organization: string, range: ReportRange) {
  const rows = await JournalEntry.aggregate([
    { $match: { ...baseMatch(organization, range), date: { $lte: range.to } } },
    { $unwind: '$lines' },
    {
      $group: {
        _id: '$lines.account',
        debit: { $sum: '$lines.debit' },
        credit: { $sum: '$lines.credit' },
      },
    },
    {
      $lookup: {
        from: 'accounts',
        localField: '_id',
        foreignField: '_id',
        as: 'account',
      },
    },
    { $unwind: '$account' },
    {
      $project: {
        code: '$account.code',
        name: '$account.name',
        type: '$account.type',
        normalBalance: '$account.normalBalance',
        debit: 1,
        credit: 1,
      },
    },
    { $sort: { code: 1 } },
  ]);

  const accounts = rows.map((row) => ({
    accountId: String(row._id),
    code: row.code as string,
    name: row.name as string,
    type: row.type as 'asset' | 'liability' | 'equity' | 'income' | 'expense',
    amount: round2(
      row.normalBalance === 'credit'
        ? Number(row.credit) - Number(row.debit)
        : Number(row.debit) - Number(row.credit),
    ),
  }));

  const pl = await profitAndLoss(organization, range);
  const assets = accounts.filter((account) => account.type === 'asset');
  const liabilities = accounts.filter((account) => account.type === 'liability');
  const equity = accounts.filter((account) => account.type === 'equity');
  const assetTotal = round2(assets.reduce((sum, account) => sum + account.amount, 0));
  const liabilityTotal = round2(liabilities.reduce((sum, account) => sum + account.amount, 0));
  const equityTotal = round2(
    equity.reduce((sum, account) => sum + account.amount, 0) + pl.totals.netProfit,
  );

  return {
    asOf: range.to,
    assets,
    liabilities,
    equity,
    totals: {
      assets: assetTotal,
      liabilities: liabilityTotal,
      equity: equityTotal,
      netIncome: pl.totals.netProfit,
      liabilitiesAndEquity: round2(liabilityTotal + equityTotal),
      balanced: Math.abs(assetTotal - (liabilityTotal + equityTotal)) < 0.02,
    },
  };
}

export async function cashflow(organization: string, range: ReportRange) {
  const { Payment, Transaction } = await import('../models');
  const paymentRows = await Payment.aggregate([
    {
      $match: {
        organization: new Types.ObjectId(organization),
        date: { $gte: range.from, $lte: range.to },
        isDeleted: { $ne: true },
      },
    },
    {
      $group: {
        _id: {
          month: { $dateToString: { format: '%Y-%m', date: '$date' } },
          type: '$type',
        },
        total: { $sum: '$amount' },
      },
    },
  ]);

  const transactionRows = await Transaction.aggregate([
    {
      $match: {
        organization: new Types.ObjectId(organization),
        status: 'posted',
        date: { $gte: range.from, $lte: range.to },
      },
    },
    {
      $group: {
        _id: {
          month: { $dateToString: { format: '%Y-%m', date: '$date' } },
          type: '$type',
        },
        total: { $sum: '$total' },
      },
    },
  ]);

  const months = new Map<string, { month: string; inflow: number; outflow: number; net: number }>();
  const ensure = (month: string) => {
    if (!months.has(month)) months.set(month, { month, inflow: 0, outflow: 0, net: 0 });
    return months.get(month)!;
  };

  for (const row of paymentRows) {
    const entry = ensure(row._id.month);
    if (row._id.type === 'receivable') entry.inflow = round2(entry.inflow + row.total);
    else entry.outflow = round2(entry.outflow + row.total);
  }
  for (const row of transactionRows) {
    const entry = ensure(row._id.month);
    if (row._id.type === 'income') entry.inflow = round2(entry.inflow + row.total);
    else entry.outflow = round2(entry.outflow + row.total);
  }
  const monthly = [...months.values()]
    .map((entry) => ({ ...entry, net: round2(entry.inflow - entry.outflow) }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return {
    period: range,
    monthly,
    totals: {
      inflow: round2(monthly.reduce((sum, entry) => sum + entry.inflow, 0)),
      outflow: round2(monthly.reduce((sum, entry) => sum + entry.outflow, 0)),
      net: round2(monthly.reduce((sum, entry) => sum + entry.net, 0)),
    },
  };
}

export async function receivablesAging(organization: string) {
  const { Invoice } = await import('../models');
  const invoices = await Invoice.find({
    organization,
    status: { $in: ['sent', 'partial', 'overdue'] },
    balance: { $gt: 0 },
  })
    .select('number balance dueDate customer')
    .populate('customer', 'name')
    .lean();

  const now = Date.now();
  const buckets = { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, over90: 0 };
  const rows = invoices.map((invoice) => {
    const daysOverdue = Math.max(0, Math.floor((now - invoice.dueDate.getTime()) / 86_400_000));
    const bucket =
      daysOverdue === 0
        ? 'current'
        : daysOverdue <= 30
          ? 'days1to30'
          : daysOverdue <= 60
            ? 'days31to60'
            : daysOverdue <= 90
              ? 'days61to90'
              : 'over90';
    buckets[bucket] += invoice.balance;
    return {
      id: String(invoice._id),
      number: invoice.number,
      customer: (invoice.customer as unknown as { name?: string })?.name ?? 'Customer',
      dueDate: invoice.dueDate,
      daysOverdue,
      balance: round2(invoice.balance),
      bucket,
    };
  });

  return {
    rows,
    buckets: Object.fromEntries(
      Object.entries(buckets).map(([key, value]) => [key, round2(value)]),
    ),
    total: round2(rows.reduce((sum, row) => sum + row.balance, 0)),
  };
}

export async function payablesAging(organization: string) {
  const { Bill } = await import('../models');
  const bills = await Bill.find({
    organization,
    status: { $in: ['open', 'partial', 'overdue'] },
    balance: { $gt: 0 },
  })
    .select('number balance dueDate supplier')
    .populate('supplier', 'name')
    .lean();

  const now = Date.now();
  const buckets = { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, over90: 0 };
  const rows = bills.map((bill) => {
    const daysOverdue = Math.max(0, Math.floor((now - bill.dueDate.getTime()) / 86_400_000));
    const bucket =
      daysOverdue === 0
        ? 'current'
        : daysOverdue <= 30
          ? 'days1to30'
          : daysOverdue <= 60
            ? 'days31to60'
            : daysOverdue <= 90
              ? 'days61to90'
              : 'over90';
    buckets[bucket] += bill.balance;
    return {
      id: String(bill._id),
      number: bill.number,
      supplier: (bill.supplier as unknown as { name?: string })?.name ?? 'Vendor',
      dueDate: bill.dueDate,
      daysOverdue,
      balance: round2(bill.balance),
      bucket,
    };
  });

  return {
    rows,
    buckets: Object.fromEntries(
      Object.entries(buckets).map(([key, value]) => [key, round2(value)]),
    ),
    total: round2(rows.reduce((sum, row) => sum + row.balance, 0)),
  };
}
