import { Notification } from '../models';
import { asyncHandler } from '../utils/asyncHandler';
import { parsePagination } from '../utils/pagination';
import { sendPaginated, sendSuccess } from '../utils/response';
import { ApiError } from '../utils/ApiError';

export const notificationController = {
  list: asyncHandler(async (req, res) => {
    const pagination = parsePagination(req.query as Record<string, unknown>, {
      defaultSort: '-createdAt',
    });
    const filter = {
      organization: req.organizationId,
      $or: [{ user: null }, { user: req.user?.id }],
    };
    if (req.query.unread === 'true') Object.assign(filter, { isRead: false });
    const [items, total, unread] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ ...filter, isRead: false }),
    ]);
    return sendPaginated(res, items, pagination.meta(total), { unread });
  }),

  unreadCount: asyncHandler(async (req, res) => {
    const count = await Notification.countDocuments({
      organization: req.organizationId,
      $or: [{ user: null }, { user: req.user?.id }],
      isRead: false,
    });
    return sendSuccess(res, { unread: count });
  }),

  markRead: asyncHandler(async (req, res) => {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        organization: req.organizationId,
        $or: [{ user: null }, { user: req.user?.id }],
      },
      { isRead: true, readAt: new Date() },
      { new: true },
    );
    if (!notification) throw ApiError.notFound('Notification');
    return sendSuccess(res, notification);
  }),

  markAllRead: asyncHandler(async (req, res) => {
    await Notification.updateMany(
      {
        organization: req.organizationId,
        $or: [{ user: null }, { user: req.user?.id }],
        isRead: false,
      },
      { isRead: true, readAt: new Date() },
    );
    return sendSuccess(res, { updated: true });
  }),

  remove: asyncHandler(async (req, res) => {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      organization: req.organizationId,
      $or: [{ user: null }, { user: req.user?.id }],
    });
    if (!notification) throw ApiError.notFound('Notification');
    return sendSuccess(res, { id: req.params.id, deleted: true });
  }),
};
