import type { Request } from 'express';
import { Types } from 'mongoose';
import { Customer, Invoice, Organization, SalesOrder, Warehouse } from '../models';
import { asyncHandler } from '../utils/asyncHandler';
import { parsePagination, searchFilter } from '../utils/pagination';
import { sendCreated, sendPaginated, sendSuccess } from '../utils/response';
import { ApiError } from '../utils/ApiError';
import { nextDocumentNumber } from '../utils/sequence';
import {
  buildDocumentLines,
  prefixFor,
  releaseOrderStock,
  reserveOrderStock,
} from '../services/sales.service';
import { createNotification } from '../services/notification.service';

function orgId(req: Request) {
  return new Types.ObjectId(req.organizationId);
}

function userId(req: Request) {
  return req.user ? new Types.ObjectId(req.user.id) : undefined;
}

export const salesOrderController = {
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
    if (req.query.paymentStatus) filter.paymentStatus = req.query.paymentStatus;
    const [items, total] = await Promise.all([
      SalesOrder.find(filter)
        .populate('customer', 'name company email phone')
        .populate('warehouse', 'name code')
        .sort(pagination.sort)
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      SalesOrder.countDocuments(filter),
    ]);
    return sendPaginated(res, items, pagination.meta(total));
  }),

  get: asyncHandler(async (req, res) => {
    const order = await SalesOrder.findOne({
      _id: req.params.id,
      organization: req.organizationId,
    })
      .populate('customer')
      .populate('warehouse', 'name code')
      .populate('quotation', 'number status')
      .lean();
    if (!order) throw ApiError.notFound('Sales order');
    return sendSuccess(res, order);
  }),

  create: asyncHandler(async (req, res) => {
    const customer = await Customer.exists({
      _id: req.body.customer,
      organization: req.organizationId,
    });
    if (!customer) throw ApiError.validation('Customer not found');
    const organization = await Organization.findById(req.organizationId).lean();
    if (!organization) throw ApiError.notFound('Organization');

    let warehouse = req.body.warehouse;
    if (!warehouse) {
      const fallback = await Warehouse.findOne({
        organization: req.organizationId,
        isDefault: true,
      }).lean();
      warehouse = fallback?._id;
    }
    const { lines, totals } = await buildDocumentLines(orgId(req), req.body.items);
    const prefix = await prefixFor(organization, 'salesOrderPrefix', 'SO');
    const number = await nextDocumentNumber(orgId(req), 'sales_order', prefix);
    const order = await SalesOrder.create({
      organization: req.organizationId,
      number,
      customer: req.body.customer,
      quotation: req.body.quotation,
      date: req.body.date ?? new Date(),
      deliveryDate: req.body.deliveryDate,
      warehouse,
      items: lines,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      taxTotal: totals.taxTotal,
      total: totals.total,
      status: req.body.status ?? 'draft',
      notes: req.body.notes,
      createdBy: req.user?.id,
    });
    return sendCreated(res, order.toJSON());
  }),

  update: asyncHandler(async (req, res) => {
    const order = await SalesOrder.findOne({
      _id: req.params.id,
      organization: req.organizationId,
    });
    if (!order) throw ApiError.notFound('Sales order');
    if (['delivered', 'cancelled'].includes(order.status)) {
      throw ApiError.conflict('Completed or cancelled orders cannot be edited');
    }
    const body = { ...(req.body as Record<string, unknown>) };
    if (body.items) {
      if (order.stockReserved) {
        throw ApiError.conflict('Release the stock reservation before changing order items');
      }
      const { lines, totals } = await buildDocumentLines(orgId(req), body.items as never);
      order.items = lines;
      order.subtotal = totals.subtotal;
      order.discountTotal = totals.discountTotal;
      order.taxTotal = totals.taxTotal;
      order.total = totals.total;
      delete body.items;
    }
    if (body.status === 'cancelled') {
      if (order.stockReserved) await releaseOrderStock(order, userId(req));
      order.stockReserved = false;
    }
    Object.assign(order, body);
    await order.save();
    return sendSuccess(res, order.toJSON());
  }),

  confirm: asyncHandler(async (req, res) => {
    const order = await SalesOrder.findOne({
      _id: req.params.id,
      organization: req.organizationId,
    });
    if (!order) throw ApiError.notFound('Sales order');
    if (!['draft', 'pending'].includes(order.status)) {
      throw ApiError.validation('Only draft or pending orders can be confirmed');
    }
    if (!order.warehouse) {
      const fallback = await Warehouse.findOne({
        organization: req.organizationId,
        isDefault: true,
      }).lean();
      if (fallback) order.warehouse = fallback._id;
    }
    if (!order.stockReserved) {
      await reserveOrderStock(order, userId(req));
      order.stockReserved = true;
    }
    order.status = 'confirmed';
    order.approvedBy = userId(req);
    await order.save();
    await createNotification({
      organization: order.organization,
      type: 'success',
      title: 'Sales order confirmed',
      message: `${order.number} has been confirmed and stock reserved.`,
      link: '/sales/orders',
    });
    return sendSuccess(res, order.toJSON());
  }),

  cancel: asyncHandler(async (req, res) => {
    const order = await SalesOrder.findOne({
      _id: req.params.id,
      organization: req.organizationId,
    });
    if (!order) throw ApiError.notFound('Sales order');
    if (['delivered', 'cancelled'].includes(order.status)) {
      throw ApiError.validation('Order cannot be cancelled');
    }
    if (order.stockReserved) {
      await releaseOrderStock(order, userId(req));
      order.stockReserved = false;
    }
    order.status = 'cancelled';
    await order.save();
    return sendSuccess(res, order.toJSON());
  }),

  advance: asyncHandler(async (req, res) => {
    const order = await SalesOrder.findOne({
      _id: req.params.id,
      organization: req.organizationId,
    });
    if (!order) throw ApiError.notFound('Sales order');
    const flow = ['draft', 'pending', 'confirmed', 'processing', 'shipped', 'delivered'];
    const next = flow[flow.indexOf(order.status) + 1];
    if (!next) throw ApiError.validation('Order cannot be advanced further');
    order.status = next as typeof order.status;
    await order.save();
    return sendSuccess(res, order.toJSON());
  }),

  remove: asyncHandler(async (req, res) => {
    const order = await SalesOrder.findOne({
      _id: req.params.id,
      organization: req.organizationId,
    });
    if (!order) throw ApiError.notFound('Sales order');
    const invoiceCount = await Invoice.countDocuments({
      organization: req.organizationId,
      salesOrder: order._id,
      status: { $ne: 'void' },
    });
    if (invoiceCount) throw ApiError.conflict('Invoiced orders cannot be deleted');
    if (order.stockReserved) await releaseOrderStock(order, userId(req));
    await order.softDelete();
    return sendSuccess(res, { id: req.params.id, deleted: true });
  }),
};
