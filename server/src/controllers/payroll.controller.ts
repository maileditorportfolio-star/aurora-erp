import { Types } from 'mongoose';
import { Employee, Organization, SalarySlip } from '../models';
import { asyncHandler } from '../utils/asyncHandler';
import { parsePagination } from '../utils/pagination';
import { sendCreated, sendPaginated, sendSuccess } from '../utils/response';
import { ApiError } from '../utils/ApiError';
import { monthRange } from '../utils/dates';
import { round2 } from '../utils/money';
import { ACCOUNT_CODES } from '../config/accounts';
import { accountByCode, postJournal } from '../services/accounting.service';

export const payrollController = {
  list: asyncHandler(async (req, res) => {
    const pagination = parsePagination(req.query as Record<string, unknown>, {
      defaultSort: '-year,-month',
    });
    const filter: Record<string, unknown> = { organization: req.organizationId };
    if (req.query.period) filter.period = req.query.period;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.employee) filter.employee = req.query.employee;
    const [items, total, summary] = await Promise.all([
      SalarySlip.find(filter)
        .populate('employee', 'firstName lastName employeeId department designation')
        .sort(pagination.sort)
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      SalarySlip.countDocuments(filter),
      SalarySlip.aggregate([
        { $match: { organization: new Types.ObjectId(req.organizationId), ...(req.query.period ? { period: req.query.period } : {}) } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            gross: { $sum: '$gross' },
            net: { $sum: '$net' },
          },
        },
      ]),
    ]);
    return sendPaginated(res, items, pagination.meta(total), { summary });
  }),

  get: asyncHandler(async (req, res) => {
    const slip = await SalarySlip.findOne({
      _id: req.params.id,
      organization: req.organizationId,
    })
      .populate('employee', 'firstName lastName employeeId department designation bank email')
      .lean();
    if (!slip) throw ApiError.notFound('Salary slip');
    return sendSuccess(res, slip);
  }),

  generate: asyncHandler(async (req, res) => {
    const period = String(req.body.period);
    const range = monthRange(period);
    if (!range) throw ApiError.validation('Invalid payroll period');
    const month = Number(period.slice(5, 7));
    const year = Number(period.slice(0, 4));

    const filter: Record<string, unknown> = {
      organization: req.organizationId,
      status: { $ne: 'terminated' },
    };
    if (req.body.employeeIds?.length) filter._id = { $in: req.body.employeeIds };
    const employees = await Employee.find(filter).lean();
    if (!employees.length) throw ApiError.validation('No eligible employees found');

    const existing = await SalarySlip.find({
      organization: req.organizationId,
      period,
      employee: { $in: employees.map((employee) => employee._id) },
    })
      .select('employee')
      .lean();
    const existingIds = new Set(existing.map((slip) => String(slip.employee)));

    const created = [];
    let skipped = 0;
    for (const employee of employees) {
      if (existingIds.has(String(employee._id))) {
        skipped += 1;
        continue;
      }
      const salary = employee.salary ?? ({} as (typeof employee)['salary']);
      const basic = round2(salary.basic ?? 0);
      const housing = round2(salary.housingAllowance ?? 0);
      const transport = round2(salary.transportAllowance ?? 0);
      const otherAllowance = round2(salary.otherAllowances ?? 0);
      const gross = round2(basic + housing + transport + otherAllowance);
      const tax = round2(gross * ((salary.taxRate ?? 0) / 100));
      const pension = round2(basic * ((salary.pensionRate ?? 0) / 100));
      const otherDeduction = round2(salary.otherDeductions ?? 0);
      const totalDeductions = round2(tax + pension + otherDeduction);
      const net = round2(gross - totalDeductions);

      const slip = await SalarySlip.create({
        organization: req.organizationId,
        employee: employee._id,
        period,
        month,
        year,
        basic,
        allowances: { housing, transport, other: otherAllowance, total: round2(housing + transport + otherAllowance) },
        deductions: { tax, pension, other: otherDeduction, total: totalDeductions },
        gross,
        net,
        status: 'draft',
        generatedBy: req.user?.id,
      });
      created.push(slip);
    }

    return sendCreated(res, {
      period,
      created: created.length,
      skipped,
      slips: created.map((slip) => slip.toJSON()),
    });
  }),

  updateStatus: asyncHandler(async (req, res) => {
    const slip = await SalarySlip.findOne({
      _id: req.params.id,
      organization: req.organizationId,
    });
    if (!slip) throw ApiError.notFound('Salary slip');
    const target = req.body.status as 'draft' | 'approved' | 'paid';
    const order = ['draft', 'approved', 'paid'];
    if (order.indexOf(target) < order.indexOf(slip.status)) {
      throw ApiError.validation('Payroll status cannot move backwards');
    }
    if (target === 'paid' && slip.status !== 'approved') {
      throw ApiError.validation('Approve the payroll before marking it paid');
    }

    if (target === 'paid' && !slip.journalPosted) {
      const organization = await Organization.findById(req.organizationId).lean();
      if (!organization) throw ApiError.notFound('Organization');
      const salaries = await accountByCode(organization._id, ACCOUNT_CODES.SALARIES);
      const bank = await accountByCode(organization._id, ACCOUNT_CODES.BANK);
      const taxPayable = await accountByCode(organization._id, ACCOUNT_CODES.TAX_PAYABLE);
      await postJournal({
        organization: organization._id,
        date: new Date(),
        description: `Payroll ${slip.period}`,
        referenceType: 'payroll',
        referenceId: slip._id,
        referenceNumber: slip.period,
        source: 'payroll',
        lines: [
          { account: salaries._id, debit: slip.gross, description: 'Payroll expense' },
          { account: bank._id, credit: slip.net, description: 'Net pay' },
          {
            account: taxPayable._id,
            credit: slip.deductions.total,
            description: 'Payroll deductions',
          },
        ],
        createdBy: req.user ? new Types.ObjectId(req.user.id) : undefined,
      });
      slip.journalPosted = true;
      slip.paidAt = new Date();
      slip.paymentMethod = req.body.paymentMethod ?? 'bank';
    }

    slip.status = target;
    await slip.save();
    return sendSuccess(res, slip.toJSON());
  }),

  remove: asyncHandler(async (req, res) => {
    const slip = await SalarySlip.findOne({
      _id: req.params.id,
      organization: req.organizationId,
    });
    if (!slip) throw ApiError.notFound('Salary slip');
    if (slip.status !== 'draft') throw ApiError.conflict('Only draft payroll can be deleted');
    await slip.softDelete();
    return sendSuccess(res, { id: req.params.id, deleted: true });
  }),

  mine: asyncHandler(async (req, res) => {
    const employee = await Employee.findOne({
      organization: req.organizationId,
      userId: req.user?.id,
    }).lean();
    if (!employee) throw ApiError.notFound('Employee profile');
    const slips = await SalarySlip.find({
      organization: req.organizationId,
      employee: employee._id,
    })
      .sort({ year: -1, month: -1 })
      .limit(36)
      .lean();
    return sendSuccess(res, slips);
  }),
};
