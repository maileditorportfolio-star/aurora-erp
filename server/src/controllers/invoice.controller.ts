import { Types } from 'mongoose';
import { Customer, Invoice, Organization, SalesOrder, type SalesOrderDocument } from '../models';
import { asyncHandler } from '../utils/asyncHandler';
import { parsePagination, searchFilter } from '../utils/pagination';
import { sendCreated, sendPaginated, sendSuccess } from '../utils/response';
import { ApiError } from '../utils/ApiError';
import { nextDocumentNumber } from '../utils/sequence';
import { buildDocumentLines, prefixFor } from '../services/sales.service';
import { issueInvoice, voidInvoice } from '../services/invoice.service';
import { generateDocumentPdf } from '../services/pdf.service';
import { round2 } from '../utils/money';

export const invoiceController = {
  list: asyncHandler(async (req, res) => {
    await Invoice.updateMany(
      {
        organization: req.organizationId,
        status: { $in: ['sent', 'partial'] },
        dueDate: { $lt: new Date() },
        balance: { $gt: 0 },
      },
      { $set: { status: 'overdue' } },
    );
    const pagination = parsePagination(req.query as Record<string, unknown>, {
      defaultSort: '-issueDate',
    });
    const filter: Record<string, unknown> = {
      organization: req.organizationId,
      ...searchFilter(pagination.search, ['number', 'notes', 'terms']),
    };
    if (req.query.customer) filter.customer = req.query.customer;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.salesOrder) filter.salesOrder = req.query.salesOrder;
    if (req.query.from || req.query.to) {
      const range: Record<string, Date> = {};
      if (req.query.from) range.$gte = new Date(String(req.query.from));
      if (req.query.to) range.$lte = new Date(String(req.query.to));
      filter.issueDate = range;
    }
    const [items, total, summary] = await Promise.all([
      Invoice.find(filter)
        .populate('customer', 'name company email phone')
        .sort(pagination.sort)
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      Invoice.countDocuments(filter),
      Invoice.aggregate([
        { $match: { organization: new Types.ObjectId(req.organizationId), status: { $ne: 'void' } } },
        {
          $group: {
            _id: null,
            total: { $sum: '$total' },
            paid: { $sum: '$amountPaid' },
            outstanding: { $sum: '$balance' },
          },
        },
      ]),
    ]);
    return sendPaginated(res, items, pagination.meta(total), {
      summary: summary[0] ?? { total: 0, paid: 0, outstanding: 0 },
    });
  }),

  get: asyncHandler(async (req, res) => {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      organization: req.organizationId,
    })
      .populate('customer')
      .populate('salesOrder', 'number status total')
      .populate('warehouse', 'name code')
      .lean();
    if (!invoice) throw ApiError.notFound('Invoice');
    if (
      ['sent', 'partial'].includes(invoice.status) &&
      invoice.balance > 0 &&
      invoice.dueDate.getTime() < Date.now()
    ) {
      await Invoice.updateOne({ _id: invoice._id }, { $set: { status: 'overdue' } });
      invoice.status = 'overdue';
    }
    return sendSuccess(res, invoice);
  }),

  create: asyncHandler(async (req, res) => {
    const organization = await Organization.findById(req.organizationId).lean();
    if (!organization) throw ApiError.notFound('Organization');

    const body = req.body as Record<string, unknown>;
    let salesOrder: SalesOrderDocument | null = null;
    let customerId = body.customer as string;
    let items = (body.items as never[]) ?? [];
    let warehouse = body.warehouse as string | undefined;

    if (body.salesOrder) {
      salesOrder = await SalesOrder.findOne({
        _id: body.salesOrder,
        organization: req.organizationId,
      });
      if (!salesOrder) throw ApiError.validation('Sales order not found');
      if (salesOrder.status === 'cancelled') throw ApiError.validation('Cancelled orders cannot be invoiced');
      const existing = await Invoice.exists({
        organization: req.organizationId,
        salesOrder: salesOrder._id,
        status: { $ne: 'void' },
      });
      if (existing) throw ApiError.conflict('This sales order already has an invoice');
      customerId = String(salesOrder.customer);
      if (!items.length) items = salesOrder.items as never[];
      warehouse = warehouse ?? (salesOrder.warehouse ? String(salesOrder.warehouse) : undefined);
    }

    if (!customerId) {
      throw ApiError.validation('A customer is required');
    }
    const customer = await Customer.exists({
      _id: customerId,
      organization: req.organizationId,
    });
    if (!customer) throw ApiError.validation('Customer not found');

    const { lines, totals } = await buildDocumentLines(
      new Types.ObjectId(req.organizationId),
      items as never,
    );
    const prefix = await prefixFor(organization, 'invoicePrefix', 'INV');
    const number = await nextDocumentNumber(
      new Types.ObjectId(req.organizationId),
      'invoice',
      prefix,
    );
    const issueDate = body.issueDate ? new Date(String(body.issueDate)) : new Date();
    const dueDays = organization.settings?.invoiceDueDays ?? 30;
    const dueDate = body.dueDate
      ? new Date(String(body.dueDate))
      : new Date(issueDate.getTime() + dueDays * 86_400_000);

    const invoice = await Invoice.create({
      organization: req.organizationId!,
      number,
      customer: customerId,
      salesOrder: salesOrder?._id,
      quotation: body.quotation as string | undefined,
      issueDate,
      dueDate,
      warehouse: warehouse ?? undefined,
      items: lines,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      taxTotal: totals.taxTotal,
      total: totals.total,
      amountPaid: 0,
      balance: totals.total,
      status: 'draft',
      notes: body.notes as string | undefined,
      terms: body.terms as string | undefined,
      createdBy: req.user?.id,
    });

    if (body.status === 'sent') {
      await issueInvoice(invoice._id, req.user ? new Types.ObjectId(req.user.id) : undefined);
    }

    const fresh = await Invoice.findById(invoice._id)
      .populate('customer', 'name company email phone')
      .lean();
    return sendCreated(res, fresh);
  }),

  update: asyncHandler(async (req, res) => {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      organization: req.organizationId,
    });
    if (!invoice) throw ApiError.notFound('Invoice');
    if (['void', 'paid'].includes(invoice.status)) {
      throw ApiError.conflict('This invoice can no longer be edited');
    }
    const allowed: Record<string, unknown> = {};
    for (const key of ['dueDate', 'notes', 'terms', 'status'] as const) {
      if (req.body[key] !== undefined) allowed[key] = req.body[key];
    }
    if (allowed.status === 'sent' && invoice.status === 'draft') {
      await issueInvoice(invoice._id, req.user ? new Types.ObjectId(req.user.id) : undefined);
      delete allowed.status;
    }
    if (allowed.status && !['draft', 'sent'].includes(String(allowed.status))) delete allowed.status;
    Object.assign(invoice, allowed);
    await invoice.save();
    return sendSuccess(res, invoice.toJSON());
  }),

  issue: asyncHandler(async (req, res) => {
    const invoice = await issueInvoice(
      String(req.params.id),
      req.user ? new Types.ObjectId(req.user.id) : undefined,
    );
    return sendSuccess(res, invoice.toJSON());
  }),

  void: asyncHandler(async (req, res) => {
    if (!req.body.reason || String(req.body.reason).trim().length < 3) {
      throw ApiError.validation('A void reason is required');
    }
    const invoice = await voidInvoice(
      String(req.params.id),
      String(req.body.reason),
      req.user ? new Types.ObjectId(req.user.id) : undefined,
    );
    return sendSuccess(res, invoice.toJSON());
  }),

  remove: asyncHandler(async (req, res) => {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      organization: req.organizationId,
    });
    if (!invoice) throw ApiError.notFound('Invoice');
    if (!['draft', 'void'].includes(invoice.status)) {
      throw ApiError.conflict('Only draft or void invoices can be deleted. Void the invoice first.');
    }
    await invoice.softDelete();
    return sendSuccess(res, { id: req.params.id, deleted: true });
  }),

  pdf: asyncHandler(async (req, res) => {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      organization: req.organizationId,
    })
      .populate('customer')
      .lean();
    if (!invoice) throw ApiError.notFound('Invoice');
    const organization = await Organization.findById(req.organizationId).lean();
    if (!organization) throw ApiError.notFound('Organization');
    const buffer = await generateDocumentPdf({
      type: 'invoice',
      document: { ...invoice, balance: round2(invoice.total - invoice.amountPaid) },
      organization,
      customer: invoice.customer as never,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${invoice.number}.pdf"`);
    return res.send(buffer);
  }),
};
