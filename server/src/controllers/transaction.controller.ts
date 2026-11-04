import { Types } from 'mongoose';
import { Account, Transaction } from '../models';
import { asyncHandler } from '../utils/asyncHandler';
import { parsePagination, searchFilter } from '../utils/pagination';
import { sendCreated, sendPaginated, sendSuccess } from '../utils/response';
import { ApiError } from '../utils/ApiError';
import { nextDocumentNumber } from '../utils/sequence';
import { postIncomeExpenseJournal, voidJournalEntry } from '../services/accounting.service';
import { createNotification } from '../services/notification.service';
import { round2 } from '../utils/money';

export const transactionController = {
  list: asyncHandler(async (req, res) => {
    const pagination = parsePagination(req.query as Record<string, unknown>, {
      defaultSort: '-date',
    });
    const filter: Record<string, unknown> = {
      organization: req.organizationId,
      ...searchFilter(pagination.search, ['number', 'description', 'reference']),
    };
    if (req.query.type) filter.type = req.query.type;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.account) filter.account = req.query.account;
    if (req.query.from || req.query.to) {
      const range: Record<string, Date> = {};
      if (req.query.from) range.$gte = new Date(String(req.query.from));
      if (req.query.to) range.$lte = new Date(String(req.query.to));
      filter.date = range;
    }
    const [items, total, summary] = await Promise.all([
      Transaction.find(filter)
        .populate('account', 'name code type')
        .populate('paymentAccount', 'name code type')
        .sort(pagination.sort)
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      Transaction.countDocuments(filter),
      Transaction.aggregate([
        {
          $match: {
            organization: new Types.ObjectId(req.organizationId),
            status: 'posted',
            ...(req.query.type ? { type: req.query.type } : {}),
          },
        },
        { $group: { _id: '$type', total: { $sum: '$total' }, count: { $sum: 1 } } },
      ]),
    ]);
    const summaryMap = Object.fromEntries(
      summary.map((row: { _id: string; total: number; count: number }) => [row._id, row.total]),
    );
    return sendPaginated(res, items, pagination.meta(total), {
      summary: {
        income: summaryMap.income ?? 0,
        expense: summaryMap.expense ?? 0,
      },
    });
  }),

  get: asyncHandler(async (req, res) => {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      organization: req.organizationId,
    })
      .populate('account', 'name code type')
      .populate('paymentAccount', 'name code type')
      .populate('journalEntry', 'number status')
      .lean();
    if (!transaction) throw ApiError.notFound('Transaction');
    return sendSuccess(res, transaction);
  }),

  create: asyncHandler(async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const account = await Account.findOne({
      _id: body.account,
      organization: req.organizationId,
    }).lean();
    if (!account) throw ApiError.validation('Account not found');
    const expectedType = body.type === 'income' ? 'income' : 'expense';
    if (account.type !== expectedType) {
      throw ApiError.validation(`Select a ${expectedType} account for this transaction`);
    }
    const paymentAccount = await Account.findOne({
      _id: body.paymentAccount,
      organization: req.organizationId,
    }).lean();
    if (!paymentAccount) throw ApiError.validation('Payment account not found');
    if (paymentAccount.type !== 'asset') {
      throw ApiError.validation('Payment account must be an asset account');
    }

    const amount = round2(Number(body.amount));
    const taxAmount = round2(Number(body.taxAmount ?? 0));
    const prefix = body.type === 'income' ? 'INC' : 'EXP';
    const number = await nextDocumentNumber(
      new Types.ObjectId(req.organizationId),
      String(body.type),
      prefix,
    );
    const transaction = await Transaction.create({
      organization: req.organizationId!,
      number,
      type: body.type as 'income' | 'expense',
      date: body.date ? new Date(String(body.date)) : new Date(),
      description: String(body.description ?? ''),
      account: account._id,
      paymentAccount: paymentAccount._id,
      amount,
      taxAmount,
      total: round2(amount + taxAmount),
      reference: body.reference as string | undefined,
      status: 'posted',
      createdBy: req.user?.id,
    });

    try {
      const journal = await postIncomeExpenseJournal(transaction);
      transaction.journalEntry = journal._id;
      await transaction.save();
    } catch (error) {
      await Transaction.deleteOne({ _id: transaction._id });
      throw error;
    }

    await createNotification({
      organization: transaction.organization,
      type: 'info',
      title: `${transaction.type === 'income' ? 'Income' : 'Expense'} recorded`,
      message: `${transaction.number}: ${transaction.description} (${round2(amount + taxAmount)}).`,
      link: '/finance/transactions',
    });
    return sendCreated(res, transaction.toJSON());
  }),

  update: asyncHandler(async (req, res) => {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      organization: req.organizationId,
    });
    if (!transaction) throw ApiError.notFound('Transaction');
    if (transaction.status === 'void') throw ApiError.conflict('Void transactions cannot be edited');
    for (const key of ['description', 'reference', 'date'] as const) {
      if (req.body[key] !== undefined) {
        (transaction as unknown as Record<string, unknown>)[key] = req.body[key];
      }
    }
    await transaction.save();
    return sendSuccess(res, transaction.toJSON());
  }),

  remove: asyncHandler(async (req, res) => {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      organization: req.organizationId,
    });
    if (!transaction) throw ApiError.notFound('Transaction');
    if (transaction.journalEntry) {
      await voidJournalEntry(transaction.journalEntry);
    }
    transaction.status = 'void';
    await transaction.save();
    await transaction.softDelete();
    return sendSuccess(res, { id: req.params.id, deleted: true });
  }),
};
