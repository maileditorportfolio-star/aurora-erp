import type { Request } from 'express';
import { Types } from 'mongoose';
import { Attendance, Employee } from '../models';
import { asyncHandler } from '../utils/asyncHandler';
import { parsePagination } from '../utils/pagination';
import { sendCreated, sendPaginated, sendSuccess } from '../utils/response';
import { ApiError } from '../utils/ApiError';
import { monthRange } from '../utils/dates';

function computeHours(clockIn?: string | null, clockOut?: string | null): number {
  if (!clockIn || !clockOut) return 0;
  const [inH, inM] = clockIn.split(':').map(Number);
  const [outH, outM] = clockOut.split(':').map(Number);
  if ([inH, inM, outH, outM].some((value) => !Number.isFinite(value))) return 0;
  const minutes = outH! * 60 + outM! - (inH! * 60 + inM!);
  return minutes > 0 ? Math.round((minutes / 60) * 100) / 100 : 0;
}

async function selfEmployee(req: Request) {
  if (!req.user) return null;
  return Employee.findOne({ organization: req.organizationId, userId: req.user.id }).lean();
}

export const attendanceController = {
  list: asyncHandler(async (req, res) => {
    const pagination = parsePagination(req.query as Record<string, unknown>, {
      defaultSort: '-date',
    });
    const filter: Record<string, unknown> = { organization: req.organizationId };
    if (req.query.employee) filter.employee = req.query.employee;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.date) {
      const date = new Date(String(req.query.date));
      const start = new Date(date);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setUTCHours(23, 59, 59, 999);
      filter.date = { $gte: start, $lte: end };
    } else if (req.query.period) {
      const range = monthRange(String(req.query.period));
      if (range) filter.date = { $gte: range.start, $lte: range.end };
    }
    if (req.membership?.role === 'employee') {
      const employee = await selfEmployee(req);
      if (!employee) return sendPaginated(res, [], pagination.meta(0));
      filter.employee = employee._id;
    }
    const [items, total] = await Promise.all([
      Attendance.find(filter)
        .populate('employee', 'firstName lastName employeeId department designation')
        .sort(pagination.sort)
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      Attendance.countDocuments(filter),
    ]);
    return sendPaginated(res, items, pagination.meta(total));
  }),

  create: asyncHandler(async (req, res) => {
    const employee = await Employee.findOne({
      _id: req.body.employee,
      organization: req.organizationId,
    }).lean();
    if (!employee) throw ApiError.validation('Employee not found');
    const existing = await Attendance.exists({
      organization: req.organizationId,
      employee: employee._id,
      date: req.body.date,
    });
    if (existing) throw ApiError.conflict('Attendance is already recorded for this employee and date');
    const hours = req.body.hours ?? computeHours(req.body.clockIn, req.body.clockOut);
    const record = await Attendance.create({
      organization: req.organizationId,
      employee: employee._id,
      date: req.body.date,
      clockIn: req.body.clockIn,
      clockOut: req.body.clockOut,
      status: req.body.status ?? 'present',
      hours,
      overtimeHours: req.body.overtimeHours ?? 0,
      note: req.body.note,
      createdBy: req.user?.id,
    });
    return sendCreated(res, record.toJSON());
  }),

  update: asyncHandler(async (req, res) => {
    const record = await Attendance.findOne({
      _id: req.params.id,
      organization: req.organizationId,
    });
    if (!record) throw ApiError.notFound('Attendance record');
    const body = { ...(req.body as Record<string, unknown>) };
    if (body.clockIn !== undefined || body.clockOut !== undefined) {
      body.hours =
        body.hours ??
        computeHours(
          (body.clockIn as string) ?? record.clockIn,
          (body.clockOut as string) ?? record.clockOut,
        );
    }
    Object.assign(record, body);
    await record.save();
    return sendSuccess(res, record.toJSON());
  }),

  remove: asyncHandler(async (req, res) => {
    const record = await Attendance.findOne({
      _id: req.params.id,
      organization: req.organizationId,
    });
    if (!record) throw ApiError.notFound('Attendance record');
    await record.softDelete();
    return sendSuccess(res, { id: req.params.id, deleted: true });
  }),

  summary: asyncHandler(async (req, res) => {
    const period = String(req.query.period ?? new Date().toISOString().slice(0, 7));
    const range = monthRange(period);
    if (!range) throw ApiError.validation('Invalid period');
    const rows = await Attendance.aggregate([
      {
        $match: {
          organization: new Types.ObjectId(req.organizationId),
          date: { $gte: range.start, $lte: range.end },
          isDeleted: { $ne: true },
        },
      },
      { $group: { _id: '$status', count: { $sum: 1 }, hours: { $sum: '$hours' } } },
    ]);
    return sendSuccess(res, { period, statuses: rows });
  }),

  mine: asyncHandler(async (req, res) => {
    const employee = await selfEmployee(req);
    if (!employee) throw ApiError.notFound('Employee profile');
    const period = String(req.query.period ?? new Date().toISOString().slice(0, 7));
    const range = monthRange(period);
    if (!range) throw ApiError.validation('Invalid period');
    const records = await Attendance.find({
      organization: req.organizationId,
      employee: employee._id,
      date: { $gte: range.start, $lte: range.end },
    })
      .sort({ date: -1 })
      .lean();
    return sendSuccess(res, records);
  }),
};
