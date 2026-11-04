import { Types } from 'mongoose';
import {
  AuditLog,
  Customer,
  Invoice,
  Product,
  Quotation,
  SalesOrder,
} from '../models';
import { cashflow, profitAndLoss } from './report.service';
import { round2 } from '../utils/money';
import { endOfMonth, format, startOfMonth, subMonths } from '../utils/dates';

function percentChange(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return round2(((current - previous) / Math.abs(previous)) * 100);
}

export async function dashboardData(organization: string, months = 12) {
  const now = new Date();
  const currentStart = startOfMonth(now);
  const currentEnd = endOfMonth(now);
  const chartStart = startOfMonth(subMonths(now, months - 1));
  const org = new Types.ObjectId(organization);

  const [pl, cash, activeCustomers, customersNew, pendingOrders, ordersNew, lowStockCount, receivables, payables, overdueCount] =
    await Promise.all([
      profitAndLoss(organization, { from: chartStart, to: currentEnd }),
      cashflow(organization, { from: chartStart, to: currentEnd }),
      Customer.countDocuments({ organization: org, status: 'active' }),
      Customer.countDocuments({
        organization: org,
        createdAt: { $gte: currentStart, $lte: currentEnd },
      }),
      SalesOrder.countDocuments({
        organization: org,
        status: { $in: ['pending', 'confirmed', 'processing'] },
      }),
      SalesOrder.countDocuments({
        organization: org,
        date: { $gte: currentStart, $lte: currentEnd },
        status: { $ne: 'cancelled' },
      }),
      Product.countDocuments({
        organization: org,
        status: 'active',
        trackInventory: true,
        type: 'goods',
        $expr: { $lte: ['$stock', '$reorderPoint'] },
      }),
      Invoice.aggregate([
        { $match: { organization: org, status: { $nin: ['void', 'draft'] }, balance: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$balance' } } },
      ]),
      Invoice.aggregate([
        {
          $match: {
            organization: org,
            status: { $in: ['open', 'partial', 'overdue'] },
            balance: { $gt: 0 },
          },
        },
        { $group: { _id: null, total: { $sum: '$balance' } } },
      ]),
      Invoice.countDocuments({
        organization: org,
        status: 'overdue',
        balance: { $gt: 0 },
      }),
    ]);

  const { Bill } = await import('../models');
  const payablesRows = await Bill.aggregate([
    {
      $match: {
        organization: org,
        status: { $in: ['open', 'partial', 'overdue'] },
        balance: { $gt: 0 },
      },
    },
    { $group: { _id: null, total: { $sum: '$balance' } } },
  ]);

  const currentMonthKey = format(now, 'yyyy-MM');
  const previousMonthKey = format(subMonths(now, 1), 'yyyy-MM');
  const currentMonth = pl.monthly.find((entry) => entry.month === currentMonthKey) ?? {
    month: currentMonthKey,
    revenue: 0,
    expenses: 0,
    profit: 0,
  };
  const previousMonth = pl.monthly.find((entry) => entry.month === previousMonthKey) ?? {
    month: previousMonthKey,
    revenue: 0,
    expenses: 0,
    profit: 0,
  };

  const [
    quotationCount,
    quotationAccepted,
    ordersCount,
    invoiceCount,
    paidInvoices,
    recentInvoices,
    lowStock,
    inventoryLevels,
    recentActivity,
    topProducts,
  ] = await Promise.all([
    Quotation.countDocuments({ organization: org }),
    Quotation.countDocuments({ organization: org, status: { $in: ['accepted', 'converted'] } }),
    SalesOrder.countDocuments({ organization: org, status: { $ne: 'cancelled' } }),
    Invoice.countDocuments({ organization: org, status: { $nin: ['void', 'draft'] } }),
    Invoice.countDocuments({ organization: org, status: 'paid' }),
    Invoice.find({ organization: org, status: { $nin: ['void', 'draft'] } })
      .populate('customer', 'name company')
      .sort({ issueDate: -1 })
      .limit(6)
      .lean(),
    Product.find({
      organization: org,
      status: 'active',
      trackInventory: true,
      type: 'goods',
      $expr: { $lte: ['$stock', '$reorderPoint'] },
    })
      .populate('category', 'name')
      .sort({ stock: 1 })
      .limit(6)
      .lean(),
    Product.find({ organization: org, status: 'active', type: 'goods' })
      .select('name stock reserved reorderPoint unit')
      .sort({ stock: -1 })
      .limit(8)
      .lean(),
    AuditLog.find({ organization: org }).sort({ createdAt: -1 }).limit(8).lean(),
    Invoice.aggregate([
      { $match: { organization: org, status: { $nin: ['void', 'draft'] } } },
      { $unwind: '$items' },
      { $match: { 'items.product': { $ne: null } } },
      {
        $group: {
          _id: '$items.product',
          quantity: { $sum: '$items.quantity' },
          revenue: { $sum: '$items.total' },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
      {
        $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' },
      },
      { $unwind: '$product' },
      {
        $project: {
          name: '$product.name',
          sku: '$product.sku',
          quantity: 1,
          revenue: { $round: ['$revenue', 2] },
        },
      },
    ]),
  ]);

  return {
    metrics: {
      revenue: currentMonth.revenue,
      expenses: currentMonth.expenses,
      profit: currentMonth.profit,
      receivables: round2(receivables[0]?.total ?? 0),
      payables: round2(payablesRows[0]?.total ?? payables[0]?.total ?? 0),
      cashBalance: round2(cash.totals.net),
      activeCustomers,
      pendingOrders,
      inventoryAlerts: lowStockCount,
      overdueInvoices: overdueCount,
    },
    changes: {
      revenue: percentChange(currentMonth.revenue, previousMonth.revenue),
      expenses: percentChange(currentMonth.expenses, previousMonth.expenses),
      profit: percentChange(currentMonth.profit, previousMonth.profit),
      customersNew,
      ordersNew,
    },
    monthlyFinancials: pl.monthly.map((entry) => ({
      month: entry.month,
      label: format(new Date(`${entry.month}-01T00:00:00Z`), 'MMM'),
      revenue: entry.revenue,
      expenses: entry.expenses,
      profit: entry.profit,
    })),
    cashflow: cash.monthly.map((entry) => ({
      month: entry.month,
      label: format(new Date(`${entry.month}-01T00:00:00Z`), 'MMM'),
      inflow: entry.inflow,
      outflow: entry.outflow,
      net: entry.net,
    })),
    salesFunnel: [
      { stage: 'Quotations', value: quotationCount },
      { stage: 'Accepted', value: quotationAccepted },
      { stage: 'Orders', value: ordersCount },
      { stage: 'Invoices', value: invoiceCount },
      { stage: 'Paid', value: paidInvoices },
    ],
    inventoryLevels: inventoryLevels.map((product) => ({
      name: product.name,
      stock: product.stock,
      reserved: product.reserved,
      reorderPoint: product.reorderPoint,
      unit: product.unit,
    })),
    lowStock: lowStock.map((product) => ({
      id: String(product._id),
      name: product.name,
      sku: product.sku,
      stock: product.stock,
      reorderPoint: product.reorderPoint,
      category: (product.category as unknown as { name?: string })?.name,
      supplier: product.supplier,
      unit: product.unit,
    })),
    recentInvoices: recentInvoices.map((invoice) => ({
      id: String(invoice._id),
      number: invoice.number,
      customer: (invoice.customer as unknown as { name?: string })?.name ?? 'Customer',
      date: invoice.issueDate,
      dueDate: invoice.dueDate,
      total: invoice.total,
      balance: invoice.balance,
      status: invoice.status,
    })),
    recentActivity: recentActivity.map((entry) => ({
      id: String(entry._id),
      actor: entry.actorName,
      action: entry.action,
      resource: entry.resource,
      createdAt: entry.createdAt,
      statusCode: entry.statusCode,
    })),
    topProducts,
    topExpenses: pl.expenses.slice(0, 5),
    generatedAt: new Date(),
  };
}
