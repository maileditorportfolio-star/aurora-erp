import type { Request } from 'express';
import { Types } from 'mongoose';
import { Employee, LeaveRequest } from '../models';
import { asyncHandler } from '../utils/asyncHandler';
import { parsePagination } from '../utils/pagination';
import { sendCreated, sendPaginated, sendSuccess } from '../utils/response';
import { ApiError } from '../utils/ApiError';
import { createNotification } from '../services/notification.service';
import { daysBetween } from '../utils/dates';

async function selfEmployee(req: Request) {
  if (!req.user) return null;
  return Employee.findOne({ organization: req.organizationId, userId: req.user.id }).lean();
}

export const leaveController = {
  list: asyncHandler(async (req, res) => {
    const pagination = parsePagination(req.query as Record<string, unknown>, {
      defaultSort: '-createdAt',
    });
    const filter: Record<string, unknown> = { organization: req.organizationId };
    if (req.query.employee) filter.employee = req.query.employee;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.type) filter.type = req.query.type;
    if (req.membership?.role === 'employee') {
      const employee = await selfEmployee(req);
      if (!employee) return sendPaginated(res, [], pagination.meta(0));
      filter.employee = employee._id;
    }
    const [items, total] = await Promise.all([
      LeaveRequest.find(filter)
        .populate('employee', 'firstName lastName employeeId department designation')
        .populate('approvedBy', 'name')
        .sort(pagination.sort)
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      LeaveRequest.countDocuments(filter),
    ]);
    return sendPaginated(res, items, pagination.meta(total));
  }),

  create: asyncHandler(async (req, res) => {
    const employee = await Employee.findOne({
      _id: req.body.employee,
      organization: req.organizationId,
    }).lean();
    if (!employee) throw ApiError.validation('Employee not found');
    if (req.membership?.role === 'employee') {
      const self = await selfEmployee(req);
      if (!self || String(self._id) !== String(employee._id)) {
        throw ApiError.forbidden('You can only request leave for yourself');
      }
    }
    const start = new Date(req.body.startDate);
    const end = new Date(req.body.endDate);
    if (end < start) throw ApiError.validation('End date must be after the start date');
    const days = req.body.days ?? Math.max(1, daysBetween(start, end) + 1);
    const overlap = await LeaveRequest.exists({
      organization: req.organizationId,
      employee: employee._id,
      status: { $in: ['pending', 'approved'] },
      startDate: { $lte: end },
      endDate: { $gte: start },
    });
    if (overlap) throw ApiError.conflict('This leave overlaps an existing request');
    const leave = await LeaveRequest.create({
      organization: req.organizationId,
      employee: employee._id,
      type: req.body.type,
      startDate: start,
      endDate: end,
      days,
      reason: req.body.reason,
      status: 'pending',
    });
    await createNotification({
      organization: leave.organization,
      type: 'info',
      title: 'Leave request submitted',
      message: `${employee.firstName} ${employee.lastName} requested ${days} day(s) of ${req.body.type} leave.`,
      link: '/hr/leaves',
    });
    return sendCreated(res, leave.toJSON());
  }),

  decide: asyncHandler(async (req, res) => {
    const leave = await LeaveRequest.findOne({
      _id: req.params.id,
      organization: req.organizationId,
    }).populate('employee', 'firstName lastName userId');
    if (!leave) throw ApiError.notFound('Leave request');
    if (leave.status !== 'pending' && req.body.decision !== 'cancelled') {
      throw ApiError.validation('Only pending requests can be approved or rejected');
    }
    if (req.body.decision === 'cancelled') {
      const employee = leave.employee as unknown as { userId?: Types.ObjectId };
      if (req.membership?.role === 'employee' && String(employee?.userId) !== req.user?.id) {
        throw ApiError.forbidden('You can only cancel your own leave');
      }
    }
    leave.status = req.body.decision;
    if (req.body.decision === 'approved' || req.body.decision === 'rejected') {
      leave.approvedBy = req.user ? new Types.ObjectId(req.user.id) : undefined;
      leave.approvedAt = new Date();
    }
    if (req.body.rejectionReason) leave.rejectionReason = req.body.rejectionReason;
    await leave.save();
    return sendSuccess(res, leave.toJSON());
  }),

  update: asyncHandler(async (req, res) => {
    const leave = await LeaveRequest.findOne({
      _id: req.params.id,
      organization: req.organizationId,
    });
    if (!leave) throw ApiError.notFound('Leave request');
    if (leave.status !== 'pending') throw ApiError.conflict('Only pending requests can be edited');
    const body = { ...(req.body as Record<string, unknown>) };
    if (body.startDate && body.endDate) {
      const start = new Date(String(body.startDate));
      const end = new Date(String(body.endDate));
      if (end < start) throw ApiError.validation('End date must be after the start date');
      body.days = body.days ?? Math.max(1, daysBetween(start, end) + 1);
    }
    Object.assign(leave, body);
    await leave.save();
    return sendSuccess(res, leave.toJSON());
  }),

  remove: asyncHandler(async (req, res) => {
    const leave = await LeaveRequest.findOne({
      _id: req.params.id,
      organization: req.organizationId,
    });
    if (!leave) throw ApiError.notFound('Leave request');
    if (leave.status === 'approved') throw ApiError.conflict('Approved leave cannot be deleted');
    await leave.softDelete();
    return sendSuccess(res, { id: req.params.id, deleted: true });
  }),

  mine: asyncHandler(async (req, res) => {
    const employee = await selfEmployee(req);
    if (!employee) throw ApiError.notFound('Employee profile');
    const leaves = await LeaveRequest.find({
      organization: req.organizationId,
      employee: employee._id,
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return sendSuccess(res, leaves);
  }),
};
