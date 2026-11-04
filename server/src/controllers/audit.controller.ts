import { asyncHandler } from '../utils/asyncHandler';
import { parsePagination } from '../utils/pagination';
import { sendPaginated } from '../utils/response';
import { AuditLog } from '../models';

export const auditController = {
  list: asyncHandler(async (req, res) => {
    const pagination = parsePagination(req.query as Record<string, unknown>, {
      defaultSort: '-createdAt',
    });
    const filter: Record<string, unknown> = { organization: req.organizationId };
    if (req.query.resource) filter.resource = req.query.resource;
    if (req.query.action) filter.action = req.query.action;
    if (req.query.actor) filter.actor = req.query.actor;
    if (req.query.from || req.query.to) {
      const range: Record<string, Date> = {};
      if (req.query.from) range.$gte = new Date(String(req.query.from));
      if (req.query.to) range.$lte = new Date(String(req.query.to));
      filter.createdAt = range;
    }
    const [items, total] = await Promise.all([
      AuditLog.find(filter)
        .populate('actor', 'name email avatarUrl')
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);
    return sendPaginated(res, items, pagination.meta(total));
  }),
};
