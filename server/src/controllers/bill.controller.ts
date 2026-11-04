import { Types } from 'mongoose';
import {
  Bill,
  GoodsReceipt,
  Organization,
  Product,
  PurchaseOrder,
  Supplier,
} from '../models';
import { asyncHandler } from '../utils/asyncHandler';
import { parsePagination, searchFilter } from '../utils/pagination';
import { sendCreated, sendPaginated, sendSuccess } from '../utils/response';
import { ApiError } from '../utils/ApiError';
import { nextDocumentNumber } from '../utils/sequence';
import { buildDocumentLines } from '../services/sales.service';
import { postBillJournal, voidJournalByReference } from '../services/accounting.service';
import { createNotification } from '../services/notification.service';
import { round2 } from '../utils/money';
import { generateDocumentPdf } from '../services/pdf.service';

async function refreshBillStatus(billId: Types.ObjectId) {
  const bill = await Bill.findById(billId);
  if (!bill) return null;
  bill.balance = round2(Math.max(0, bill.total - bill.amountPaid));
  if (bill.status !== 'void') {
    if (bill.balance <= 0.009) bill.status = 'paid';
    else if (bill.amountPaid > 0) bill.status = 'partial';
    else if (bill.dueDate.getTime() < Date.now()) bill.status = 'overdue';
    else bill.status = bill.status === 'draft' ? 'draft' : 'open';
  }
  await bill.save();
  return bill;
}

export const billController = {
  list: asyncHandler(async (req, res) => {
    await Bill.updateMany(
      {
        organization: req.organizationId,
        status: { $in: ['open', 'partial'] },
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
      ...searchFilter(pagination.search, ['number', 'notes']),
    };
    if (req.query.supplier) filter.supplier = req.query.supplier;
    if (req.query.status) filter.status = req.query.status;
    const [items, total, summary] = await Promise.all([
      Bill.find(filter)
        .populate('supplier', 'name company email')
        .populate('purchaseOrder', 'number')
        .sort(pagination.sort)
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      Bill.countDocuments(filter),
      Bill.aggregate([
        {
          $match: {
            organization: new Types.ObjectId(req.organizationId),
            status: { $nin: ['void', 'paid', 'draft'] },
          },
        },
        { $group: { _id: null, total: { $sum: '$total' }, outstanding: { $sum: '$balance' } } },
      ]),
    ]);
    return sendPaginated(res, items, pagination.meta(total), {
      summary: summary[0] ?? { total: 0, outstanding: 0 },
    });
  }),

  get: asyncHandler(async (req, res) => {
    const bill = await Bill.findOne({ _id: req.params.id, organization: req.organizationId })
      .populate('supplier')
      .populate('purchaseOrder', 'number status')
      .populate('goodsReceipt', 'number receivedDate')
      .lean();
    if (!bill) throw ApiError.notFound('Bill');
    return sendSuccess(res, bill);
  }),

  create: asyncHandler(async (req, res) => {
    const organization = await Organization.findById(req.organizationId).lean();
    if (!organization) throw ApiError.notFound('Organization');
    const body = req.body as Record<string, unknown>;
    const supplier = await Supplier.findOne({
      _id: body.supplier,
      organization: req.organizationId,
    }).lean();
    if (!supplier) throw ApiError.validation('Vendor not found');

    let rawItems = (body.items as Array<Record<string, unknown>>) ?? [];
    let goodsReceiptId: Types.ObjectId | undefined;
    let purchaseOrderId: Types.ObjectId | undefined;

    if (body.goodsReceipt) {
      const receipt = await GoodsReceipt.findOne({
        _id: body.goodsReceipt,
        organization: req.organizationId,
      }).lean();
      if (!receipt) throw ApiError.validation('Goods receipt not found');
      if (receipt.status !== 'received') {
        throw ApiError.validation('Goods must be received before creating a bill');
      }
      const existing = await Bill.exists({
        organization: req.organizationId,
        goodsReceipt: receipt._id,
        status: { $ne: 'void' },
      });
      if (existing) throw ApiError.conflict('This goods receipt has already been billed');
      goodsReceiptId = receipt._id;
      purchaseOrderId = receipt.purchaseOrder;
      if (!rawItems.length) {
        const products = await Product.find({
          _id: { $in: receipt.items.map((item) => item.product) },
          organization: req.organizationId,
        })
          .select('name sku')
          .lean();
        const byId = new Map(products.map((product) => [String(product._id), product]));
        rawItems = receipt.items
          .filter((item) => item.acceptedQty > 0)
          .map((item) => ({
            product: String(item.product),
            description:
              item.description || byId.get(String(item.product))?.name || 'Received goods',
            quantity: item.acceptedQty,
            unitCost: item.unitCost,
            taxRate: 0,
          }));
      }
    } else if (body.purchaseOrder) {
      const order = await PurchaseOrder.findOne({
        _id: body.purchaseOrder,
        organization: req.organizationId,
      }).lean();
      if (!order) throw ApiError.validation('Purchase order not found');
      purchaseOrderId = order._id;
      if (!rawItems.length) {
        rawItems = order.items.map((item) => ({
          product: item.product ? String(item.product) : undefined,
          description: item.description,
          quantity: item.quantity,
          unitCost: item.unitPrice || item.unitCost,
          discountRate: item.discountRate,
          taxRate: item.taxRate,
        }));
      }
    }

    if (!rawItems.length) throw ApiError.validation('Add at least one bill line');

    const { lines, totals } = await buildDocumentLines(
      new Types.ObjectId(req.organizationId),
      rawItems as never,
      'unitCost',
    );
    const number = await nextDocumentNumber(
      new Types.ObjectId(req.organizationId),
      'bill',
      'BILL',
    );
    const issueDate = body.issueDate ? new Date(String(body.issueDate)) : new Date();
    const dueDate = new Date(String(body.dueDate));
    const bill = await Bill.create({
      organization: req.organizationId!,
      number,
      supplier: supplier._id,
      purchaseOrder: purchaseOrderId,
      goodsReceipt: goodsReceiptId,
      issueDate,
      dueDate,
      items: lines,
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      taxTotal: totals.taxTotal,
      total: totals.total,
      amountPaid: 0,
      balance: totals.total,
      status: 'open',
      notes: body.notes as string | undefined,
      createdBy: req.user?.id,
    });

    await Supplier.updateOne({ _id: supplier._id }, { $inc: { balance: totals.total } });
    await postBillJournal(bill);
    await createNotification({
      organization: bill.organization,
      type: 'info',
      title: 'Vendor bill recorded',
      message: `${bill.number} for ${organization.settings?.currency ?? 'USD'} ${totals.total.toFixed(2)} is due ${dueDate.toLocaleDateString()}.`,
      link: '/purchases/bills',
    });
    return sendCreated(res, bill.toJSON());
  }),

  update: asyncHandler(async (req, res) => {
    const bill = await Bill.findOne({ _id: req.params.id, organization: req.organizationId });
    if (!bill) throw ApiError.notFound('Bill');
    if (['void', 'paid'].includes(bill.status)) {
      throw ApiError.conflict('This bill can no longer be edited');
    }
    if (req.body.dueDate) bill.dueDate = new Date(String(req.body.dueDate));
    if (req.body.notes !== undefined) bill.notes = req.body.notes;
    await bill.save();
    await refreshBillStatus(bill._id);
    return sendSuccess(res, bill.toJSON());
  }),

  void: asyncHandler(async (req, res) => {
    const bill = await Bill.findOne({ _id: req.params.id, organization: req.organizationId });
    if (!bill) throw ApiError.notFound('Bill');
    if (bill.status === 'void') throw ApiError.validation('Bill is already void');
    if (bill.amountPaid > 0) {
      throw ApiError.conflict('Void the vendor payments before voiding this bill');
    }
    await voidJournalByReference(bill.organization, 'bill', bill._id);
    await Supplier.updateOne({ _id: bill.supplier }, { $inc: { balance: -bill.total } });
    bill.status = 'void';
    bill.voidedAt = new Date();
    await bill.save();
    return sendSuccess(res, bill.toJSON());
  }),

  remove: asyncHandler(async (req, res) => {
    const bill = await Bill.findOne({ _id: req.params.id, organization: req.organizationId });
    if (!bill) throw ApiError.notFound('Bill');
    if (bill.amountPaid > 0) {
      throw ApiError.conflict('Bills with payments cannot be deleted');
    }
    if (bill.status !== 'void') {
      await voidJournalByReference(bill.organization, 'bill', bill._id);
      await Supplier.updateOne({ _id: bill.supplier }, { $inc: { balance: -bill.total } });
    }
    await bill.softDelete();
    return sendSuccess(res, { id: req.params.id, deleted: true });
  }),

  pdf: asyncHandler(async (req, res) => {
    const bill = await Bill.findOne({ _id: req.params.id, organization: req.organizationId })
      .populate('supplier')
      .lean();
    if (!bill) throw ApiError.notFound('Bill');
    const organization = await Organization.findById(req.organizationId).lean();
    if (!organization) throw ApiError.notFound('Organization');
    const buffer = await generateDocumentPdf({
      type: 'bill',
      document: bill,
      organization,
      customer: bill.supplier as never,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${bill.number}.pdf"`);
    return res.send(buffer);
  }),
};
