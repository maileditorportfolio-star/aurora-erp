import { Types } from 'mongoose';
import { Account, JournalEntry } from '../models';
import { asyncHandler } from '../utils/asyncHandler';
import { parsePagination, searchFilter } from '../utils/pagination';
import { sendCreated, sendPaginated, sendSuccess } from '../utils/response';
import { ApiError } from '../utils/ApiError';
import { postJournal, voidJournalEntry } from '../services/accounting.service';

export const journalController = {
  list: asyncHandler(async (req, res) => {
    const pagination = parsePagination(req.query as Record<string, unknown>, {
      defaultSort: '-date',
    });
    const filter: Record<string, unknown> = {
      organization: req.organizationId,
      ...searchFilter(pagination.search, ['number', 'description', 'referenceNumber']),
    };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.source) filter.source = req.query.source;
    if (req.query.account) filter['lines.account'] = req.query.account;
    if (req.query.from || req.query.to) {
      const range: Record<string, Date> = {};
      if (req.query.from) range.$gte = new Date(String(req.query.from));
      if (req.query.to) range.$lte = new Date(String(req.query.to));
      filter.date = range;
    }
    const [items, total] = await Promise.all([
      JournalEntry.find(filter)
        .populate('lines.account', 'name code type')
        .populate('createdBy', 'name email')
        .sort(pagination.sort)
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      JournalEntry.countDocuments(filter),
    ]);
    return sendPaginated(res, items, pagination.meta(total));
  }),

  get: asyncHandler(async (req, res) => {
    const entry = await JournalEntry.findOne({
      _id: req.params.id,
      organization: req.organizationId,
    })
      .populate('lines.account', 'name code type')
      .populate('createdBy', 'name email')
      .lean();
    if (!entry) throw ApiError.notFound('Journal entry');
    return sendSuccess(res, entry);
  }),

  create: asyncHandler(async (req, res) => {
    const accountIds = (req.body.lines as Array<{ account: string }>).map((line) => line.account);
    const accounts = await Account.countDocuments({
      organization: req.organizationId,
      _id: { $in: accountIds },
    });
    if (accounts !== new Set(accountIds).size) {
      throw ApiError.validation('One or more accounts are invalid');
    }
    const entry = await postJournal({
      organization: new Types.ObjectId(req.organizationId),
      date: req.body.date ? new Date(req.body.date) : new Date(),
      description: req.body.description,
      referenceNumber: req.body.referenceNumber,
      source: 'manual',
      lines: req.body.lines,
      createdBy: req.user ? new Types.ObjectId(req.user.id) : undefined,
    });
    return sendCreated(res, entry.toJSON());
  }),

  void: asyncHandler(async (req, res) => {
    const entry = await JournalEntry.findOne({
      _id: req.params.id,
      organization: req.organizationId,
    });
    if (!entry) throw ApiError.notFound('Journal entry');
    if (entry.source !== 'manual') {
      throw ApiError.validation('System-generated entries are voided from their source document');
    }
    const voided = await voidJournalEntry(entry._id);
    return sendSuccess(res, voided.toJSON());
  }),

  remove: asyncHandler(async (req, res) => {
    const entry = await JournalEntry.findOne({
      _id: req.params.id,
      organization: req.organizationId,
    });
    if (!entry) throw ApiError.notFound('Journal entry');
    if (entry.status === 'posted') {
      if (entry.source !== 'manual') {
        throw ApiError.validation('Void the source document instead of deleting this entry');
      }
      await voidJournalEntry(entry._id);
    }
    await entry.softDelete();
    return sendSuccess(res, { id: req.params.id, deleted: true });
  }),
};
