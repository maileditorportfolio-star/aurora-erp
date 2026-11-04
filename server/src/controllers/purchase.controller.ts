import type { Request } from 'express';
import { Types } from 'mongoose';
import {
  Bill,
  GoodsReceipt,
  Organization,
  PurchaseOrder,
  Supplier,
  Warehouse,
} from '../models';
import { asyncHandler } from '../utils/asyncHandler';
import { parsePagination, searchFilter } from '../utils/pagination';
import { sendCreated, sendPaginated, sendSuccess } from '../utils/response';
import { ApiError } from '../utils/ApiError';
import { nextDocumentNumber } from '../utils/sequence';
import { buildDocumentLines, prefixFor } from '../services/sales.service';
import { createNotification } from '../services/notification.service';
import { generateDocumentPdf } from '../services/pdf.service';

function orgId(req: Request) {
  return new Types.ObjectId(req.organizationId);
}

async function defaultWarehouse(organization: Types.ObjectId) {
  const warehouse = await Warehouse.findOne({ organization, isDefault: true }).lean();
  return warehouse?._id;
}

export const purchaseOrderController = {
  list: asyncHandler(async (req, res) => {
    const pagination = parsePagination(req.query as Record<string, unknown>, {
      defaultSort: '-date',
    });
    const filter: Record<string, unknown> = {
      organization: req.organizationId,
      ...searchFilter(pagination.search, ['number', 'notes']),
    };
    if (req.query.supplier) filter.supplier = req.query.supplier;
    if (req.query.status) filter.status = req.query.status;
    const [items, total] = await Promise.all([
      PurchaseOrder.find(filter)
        .populate('supplier', 'name company email phone')
        .populate('warehouse', 'name code')
        .sort(pagination.sort)
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      PurchaseOrder.countDocuments(filter),
    ]);
    return sendPaginated(res, items, pagination.meta(total));
  }),

  get: asyncHandler(async (req, res) => {
    const order = await PurchaseOrder.findOne({
      _id: req.params.id,
      organization: req.organizationId,
    })
      .populate('supplier')
      .populate('warehouse', 'name code')
      .lean();
    if (!order) throw ApiError.notFound('Purchase order');
    const receipts = await GoodsReceipt.find({
      purchaseOrder: order._id,
      organization: req.organizationId,
    })
      .select('number receivedDate status total')
      .lean();
    return sendSuccess(res, { ...order, receipts });
  }),

  create: asyncHandler(async (req, res) => {
    const supplier = await Supplier.exists({
      _id: req.body.supplier,
      organization: req.organizationId,
    });
    if (!supplier) throw ApiError.validation('Vendor not found');
    const organization = await Organization.findById(req.organizationId).lean();
    if (!organization) throw ApiError.notFound('Organization');
    const { lines, totals } = await buildDocumentLines(
      orgId(req),
      req.body.items,
      'unitCost',
    );
    const prefix = await prefixFor(organization, 'purchaseOrderPrefix', 'PO');
    const number = await nextDocumentNumber(orgId(req), 'purchase_order', prefix);
    const order = await PurchaseOrder.create({
      organization: req.organizationId,
      number,
      supplier: req.body.supplier,
      date: req.body.date ?? new Date(),
      expectedDate: req.body.expectedDate,
      warehouse: req.body.warehouse ?? (await defaultWarehouse(orgId(req))),
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
    return sendCreated(res, order.toJSON());
  }),

  update: asyncHandler(async (req, res) => {
    const order = await PurchaseOrder.findOne({
      _id: req.params.id,
      organization: req.organizationId,
    });
    if (!order) throw ApiError.notFound('Purchase order');
    if (['received', 'cancelled'].includes(order.status)) {
      throw ApiError.conflict('This purchase order can no longer be edited');
    }
    const body = { ...(req.body as Record<string, unknown>) };
    if (body.items) {
      const { lines, totals } = await buildDocumentLines(
        orgId(req),
        body.items as never,
        'unitCost',
      );
      order.items = lines;
      order.subtotal = totals.subtotal;
      order.discountTotal = totals.discountTotal;
      order.taxTotal = totals.taxTotal;
      order.total = totals.total;
      delete body.items;
    }
    if (body.status && !['draft', 'pending', 'cancelled'].includes(String(body.status))) {
      delete body.status;
    }
    if (body.status === 'cancelled') {
      const receipts = await GoodsReceipt.countDocuments({
        purchaseOrder: order._id,
        stockApplied: true,
      });
      if (receipts) throw ApiError.conflict('Received purchase orders cannot be cancelled');
    }
    Object.assign(order, body);
    await order.save();
    return sendSuccess(res, order.toJSON());
  }),

  approve: asyncHandler(async (req, res) => {
    const order = await PurchaseOrder.findOne({
      _id: req.params.id,
      organization: req.organizationId,
    });
    if (!order) throw ApiError.notFound('Purchase order');
    if (!['draft', 'pending'].includes(order.status)) {
      throw ApiError.validation('Only draft or pending purchase orders can be approved');
    }
    order.status = 'approved';
    order.approvedBy = req.user ? new Types.ObjectId(req.user.id) : undefined;
    await order.save();
    return sendSuccess(res, order.toJSON());
  }),

  remove: asyncHandler(async (req, res) => {
    const order = await PurchaseOrder.findOne({
      _id: req.params.id,
      organization: req.organizationId,
    });
    if (!order) throw ApiError.notFound('Purchase order');
    const [receipts, bills] = await Promise.all([
      GoodsReceipt.countDocuments({ purchaseOrder: order._id }),
      Bill.countDocuments({ purchaseOrder: order._id, status: { $ne: 'void' } }),
    ]);
    if (receipts || bills) {
      throw ApiError.conflict('Purchase orders with receipts or bills cannot be deleted');
    }
    await order.softDelete();
    return sendSuccess(res, { id: req.params.id, deleted: true });
  }),

  pdf: asyncHandler(async (req, res) => {
    const order = await PurchaseOrder.findOne({
      _id: req.params.id,
      organization: req.organizationId,
    })
      .populate('supplier')
      .lean();
    if (!order) throw ApiError.notFound('Purchase order');
    const organization = await Organization.findById(req.organizationId).lean();
    if (!organization) throw ApiError.notFound('Organization');
    const buffer = await generateDocumentPdf({
      type: 'purchase_order',
      document: order,
      organization,
      customer: order.supplier as never,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${order.number}.pdf"`);
    return res.send(buffer);
  }),
};

async function reconcilePurchaseOrder(orderId: Types.ObjectId) {
  const order = await PurchaseOrder.findById(orderId);
  if (!order) return;
  const receipts = await GoodsReceipt.find({
    purchaseOrder: order._id,
    status: 'received',
    stockApplied: true,
  }).lean();
  const accepted = new Map<string, number>();
  for (const receipt of receipts) {
    for (const item of receipt.items) {
      accepted.set(String(item.product), (accepted.get(String(item.product)) ?? 0) + item.acceptedQty);
    }
  }
  const fullyReceived = order.items.every(
    (item) => (accepted.get(String(item.product)) ?? 0) >= item.quantity,
  );
  const anyReceived = receipts.length > 0;
  order.status = fullyReceived ? 'received' : anyReceived ? 'partial' : order.status;
  await order.save();
}

async function applyReceiptStock(
  receipt: InstanceType<typeof GoodsReceipt>,
  actorId?: Types.ObjectId,
) {
  if (receipt.stockApplied) return;
  const { receiveStock } = await import('../services/inventory.service');
  for (const item of receipt.items) {
    if (item.acceptedQty <= 0) continue;
    await receiveStock({
      organization: receipt.organization,
      productId: item.product,
      warehouseId: receipt.warehouse,
      quantity: item.acceptedQty,
      reference: { type: 'goods_receipt', id: receipt._id, number: receipt.number },
      note: `Goods receipt ${receipt.number}`,
      userId: actorId,
    });
  }
  receipt.stockApplied = true;
  receipt.status = 'received';
  await receipt.save();
  await reconcilePurchaseOrder(receipt.purchaseOrder);
}

export const goodsReceiptController = {
  list: asyncHandler(async (req, res) => {
    const pagination = parsePagination(req.query as Record<string, unknown>, {
      defaultSort: '-receivedDate',
    });
    const filter: Record<string, unknown> = {
      organization: req.organizationId,
      ...searchFilter(pagination.search, ['number', 'notes']),
    };
    if (req.query.supplier) filter.supplier = req.query.supplier;
    if (req.query.purchaseOrder) filter.purchaseOrder = req.query.purchaseOrder;
    if (req.query.status) filter.status = req.query.status;
    const [items, total] = await Promise.all([
      GoodsReceipt.find(filter)
        .populate('supplier', 'name company')
        .populate('purchaseOrder', 'number status')
        .populate('warehouse', 'name code')
        .sort(pagination.sort)
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      GoodsReceipt.countDocuments(filter),
    ]);
    return sendPaginated(res, items, pagination.meta(total));
  }),

  get: asyncHandler(async (req, res) => {
    const receipt = await GoodsReceipt.findOne({
      _id: req.params.id,
      organization: req.organizationId,
    })
      .populate('supplier')
      .populate('purchaseOrder', 'number status items total')
      .populate('warehouse', 'name code')
      .populate('items.product', 'name sku unit')
      .lean();
    if (!receipt) throw ApiError.notFound('Goods receipt');
    return sendSuccess(res, receipt);
  }),

  create: asyncHandler(async (req, res) => {
    const order = await PurchaseOrder.findOne({
      _id: req.body.purchaseOrder,
      organization: req.organizationId,
    });
    if (!order) throw ApiError.validation('Purchase order not found');
    if (order.status === 'cancelled') throw ApiError.validation('Purchase order is cancelled');
    const warehouse = await Warehouse.exists({
      _id: req.body.warehouse,
      organization: req.organizationId,
    });
    if (!warehouse) throw ApiError.validation('Warehouse not found');

    const items = req.body.items.map((item: Record<string, unknown>) => {
      const received = Number(item.receivedQty);
      const accepted = Number(item.acceptedQty);
      const rejected = Number(item.rejectedQty ?? 0);
      if (accepted + rejected > received + 0.001) {
        throw ApiError.validation('Accepted plus rejected quantity cannot exceed received quantity');
      }
      return {
        product: item.product,
        description: item.description,
        orderedQty: Number(item.orderedQty ?? 0),
        receivedQty: received,
        acceptedQty: accepted,
        rejectedQty: rejected,
        unitCost: Number(item.unitCost ?? 0),
        total: Math.round(accepted * Number(item.unitCost ?? 0) * 100) / 100,
      };
    });
    const total = items.reduce((sum: number, item: { total: number }) => sum + item.total, 0);
    const number = await nextDocumentNumber(orgId(req), 'goods_receipt', 'GRN');
    const receipt = await GoodsReceipt.create({
      organization: req.organizationId,
      number,
      purchaseOrder: order._id,
      supplier: order.supplier,
      warehouse: req.body.warehouse,
      receivedDate: req.body.receivedDate ?? new Date(),
      items,
      total,
      notes: req.body.notes,
      status: 'draft',
      stockApplied: false,
      createdBy: req.user?.id,
    });

    if ((req.body.status ?? 'received') === 'received') {
      await applyReceiptStock(receipt, req.user ? new Types.ObjectId(req.user.id) : undefined);
      await createNotification({
        organization: receipt.organization,
        type: 'success',
        title: 'Goods received',
        message: `${receipt.number} added ${items.length} line(s) to inventory.`,
        link: '/purchases/receipts',
      });
    }
    return sendCreated(res, receipt.toJSON());
  }),

  receive: asyncHandler(async (req, res) => {
    const receipt = await GoodsReceipt.findOne({
      _id: req.params.id,
      organization: req.organizationId,
    });
    if (!receipt) throw ApiError.notFound('Goods receipt');
    if (receipt.stockApplied) throw ApiError.validation('Stock has already been received');
    await applyReceiptStock(receipt, req.user ? new Types.ObjectId(req.user.id) : undefined);
    return sendSuccess(res, receipt.toJSON());
  }),

  update: asyncHandler(async (req, res) => {
    const receipt = await GoodsReceipt.findOne({
      _id: req.params.id,
      organization: req.organizationId,
    });
    if (!receipt) throw ApiError.notFound('Goods receipt');
    if (receipt.stockApplied) throw ApiError.conflict('Received goods cannot be edited');
    for (const key of ['receivedDate', 'notes'] as const) {
      if (req.body[key] !== undefined) (receipt as unknown as Record<string, unknown>)[key] = req.body[key];
    }
    await receipt.save();
    return sendSuccess(res, receipt.toJSON());
  }),

  remove: asyncHandler(async (req, res) => {
    const receipt = await GoodsReceipt.findOne({
      _id: req.params.id,
      organization: req.organizationId,
    });
    if (!receipt) throw ApiError.notFound('Goods receipt');
    if (receipt.stockApplied) {
      const { issueStock } = await import('../services/inventory.service');
      for (const item of receipt.items) {
        if (item.acceptedQty > 0) {
          await issueStock({
            organization: receipt.organization,
            productId: item.product,
            warehouseId: receipt.warehouse,
            quantity: item.acceptedQty,
            note: `Reversal of goods receipt ${receipt.number}`,
            reference: { type: 'goods_receipt_reversal', id: receipt._id, number: receipt.number },
            userId: req.user ? new Types.ObjectId(req.user.id) : undefined,
          });
        }
      }
    }
    await receipt.softDelete();
    await reconcilePurchaseOrder(receipt.purchaseOrder);
    return sendSuccess(res, { id: req.params.id, deleted: true });
  }),
};
