import type { Request } from 'express';
import { Types } from 'mongoose';
import { Customer, Organization, Quotation } from '../models';
import { asyncHandler } from '../utils/asyncHandler';
import { parsePagination, searchFilter } from '../utils/pagination';
import { sendCreated, sendPaginated, sendSuccess } from '../utils/response';
import { ApiError } from '../utils/ApiError';
import { nextDocumentNumber } from '../utils/sequence';
import { buildDocumentLines, createSalesOrderFromQuotation, prefixFor } from '../services/sales.service';
import { generateDocumentPdf } from '../services/pdf.service';

function orgId(req: Request) {
  return new Types.ObjectId(req.organizationId);
}

export const quotationController = {
  list: asyncHandler(async (req, res) => {
    const pagination = parsePagination(req.query as Record<string, unknown>, {
      defaultSort: '-date',
    });
    const filter: Record<string, unknown> = {
      organization: req.organizationId,
      ...searchFilter(pagination.search, ['number', 'notes']),
    };
    if (req.query.customer) filter.customer = req.query.customer;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.from || req.query.to) {
      const range: Record<string, Date> = {};
      if (req.query.from) range.$gte = new Date(String(req.query.from));
      if (req.query.to) range.$lte = new Date(String(req.query.to));
      filter.date = range;
    }
    const [items, total] = await Promise.all([
      Quotation.find(filter)
        .populate('customer', 'name company email phone')
        .sort(pagination.sort)
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      Quotation.countDocuments(filter),
    ]);
    return sendPaginated(res, items, pagination.meta(total));
  }),

  get: asyncHandler(async (req, res) => {
    const quotation = await Quotation.findOne({
      _id: req.params.id,
      organization: req.organizationId,
    })
      .populate('customer')
      .populate('convertedOrder', 'number status total')
      .lean();
    if (!quotation) throw ApiError.notFound('Quotation');
    return sendSuccess(res, quotation);
  }),

  create: asyncHandler(async (req, res) => {
    const customer = await Customer.findOne({
      _id: req.body.customer,
      organization: req.organizationId,
    }).lean();
    if (!customer) throw ApiError.validation('Customer not found');
    const organization = await Organization.findById(req.organizationId).lean();
    if (!organization) throw ApiError.notFound('Organization');

    const { lines, totals } = await buildDocumentLines(orgId(req), req.body.items);
    const prefix = await prefixFor(organization, 'quotationPrefix', 'QUO');
    const number = await nextDocumentNumber(orgId(req), 'quotation', prefix);
    const quotation = await Quotation.create({
      organization: req.organizationId,
      number,
      customer: req.body.customer,
      date: req.body.date ?? new Date(),
      validUntil: req.body.validUntil,
      items: lines,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      taxTotal: totals.taxTotal,
      total: totals.total,
      status: req.body.status ?? 'draft',
      notes: req.body.notes,
      terms: req.body.terms,
      createdBy: req.user?.id,
    });
    return sendCreated(res, quotation.toJSON());
  }),

  update: asyncHandler(async (req, res) => {
    const quotation = await Quotation.findOne({
      _id: req.params.id,
      organization: req.organizationId,
    });
    if (!quotation) throw ApiError.notFound('Quotation');
    if (quotation.status === 'converted') {
      throw ApiError.conflict('Converted quotations cannot be edited');
    }
    const body = { ...(req.body as Record<string, unknown>) };
    if (body.items) {
      const { lines, totals } = await buildDocumentLines(orgId(req), body.items as never);
      quotation.items = lines;
      quotation.subtotal = totals.subtotal;
      quotation.discountTotal = totals.discountTotal;
      quotation.taxTotal = totals.taxTotal;
      quotation.total = totals.total;
      delete body.items;
      delete body.subtotal;
      delete body.discountTotal;
      delete body.taxTotal;
      delete body.total;
    }
    if (body.customer) {
      const customer = await Customer.exists({
        _id: body.customer,
        organization: req.organizationId,
      });
      if (!customer) throw ApiError.validation('Customer not found');
    }
    Object.assign(quotation, body);
    await quotation.save();
    return sendSuccess(res, quotation.toJSON());
  }),

  remove: asyncHandler(async (req, res) => {
    const quotation = await Quotation.findOne({
      _id: req.params.id,
      organization: req.organizationId,
    });
    if (!quotation) throw ApiError.notFound('Quotation');
    if (quotation.status === 'converted') {
      throw ApiError.conflict('Converted quotations cannot be deleted');
    }
    await quotation.softDelete();
    return sendSuccess(res, { id: req.params.id, deleted: true });
  }),

  convert: asyncHandler(async (req, res) => {
    const quotation = await Quotation.findOne({
      _id: req.params.id,
      organization: req.organizationId,
    });
    if (!quotation) throw ApiError.notFound('Quotation');
    if (quotation.status === 'converted') throw ApiError.conflict('Quotation is already converted');
    if (['rejected', 'expired'].includes(quotation.status)) {
      throw ApiError.validation('Only open quotations can be converted');
    }
    const order = await createSalesOrderFromQuotation(
      quotation,
      req.user ? new Types.ObjectId(req.user.id) : undefined,
    );
    return sendCreated(res, order.toJSON());
  }),

  pdf: asyncHandler(async (req, res) => {
    const quotation = await Quotation.findOne({
      _id: req.params.id,
      organization: req.organizationId,
    })
      .populate('customer')
      .lean();
    if (!quotation) throw ApiError.notFound('Quotation');
    const organization = await Organization.findById(req.organizationId).lean();
    if (!organization) throw ApiError.notFound('Organization');
    const buffer = await generateDocumentPdf({
      type: 'quotation',
      document: quotation,
      organization,
      customer: quotation.customer as never,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${quotation.number}.pdf"`);
    return res.send(buffer);
  }),
};
