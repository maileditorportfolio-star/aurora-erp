import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import {
  balanceSheet,
  cashflow,
  parseReportRange,
  payablesAging,
  profitAndLoss,
  receivablesAging,
  trialBalance,
} from '../services/report.service';

export const reportController = {
  profitLoss: asyncHandler(async (req, res) => {
    const range = parseReportRange(req.query as Record<string, unknown>);
    return sendSuccess(res, await profitAndLoss(req.organizationId!, range));
  }),

  trialBalance: asyncHandler(async (req, res) => {
    const range = parseReportRange(req.query as Record<string, unknown>);
    return sendSuccess(res, await trialBalance(req.organizationId!, range));
  }),

  balanceSheet: asyncHandler(async (req, res) => {
    const range = parseReportRange(req.query as Record<string, unknown>);
    return sendSuccess(res, await balanceSheet(req.organizationId!, range));
  }),

  cashflow: asyncHandler(async (req, res) => {
    const range = parseReportRange(req.query as Record<string, unknown>);
    return sendSuccess(res, await cashflow(req.organizationId!, range));
  }),

  receivablesAging: asyncHandler(async (req, res) => {
    return sendSuccess(res, await receivablesAging(req.organizationId!));
  }),

  payablesAging: asyncHandler(async (req, res) => {
    return sendSuccess(res, await payablesAging(req.organizationId!));
  }),

  summary: asyncHandler(async (req, res) => {
    const range = parseReportRange(req.query as Record<string, unknown>);
    const [pl, balance, cash] = await Promise.all([
      profitAndLoss(req.organizationId!, range),
      balanceSheet(req.organizationId!, range),
      cashflow(req.organizationId!, range),
    ]);
    return sendSuccess(res, {
      period: range,
      profitLoss: pl.totals,
      balanceSheet: balance.totals,
      cashflow: cash.totals,
      monthly: pl.monthly,
    });
  }),
};
