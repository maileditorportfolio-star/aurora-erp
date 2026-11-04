import { Types } from 'mongoose';
import {
  Bill,
  Customer,
  Invoice,
  Organization,
  Payment,
  Supplier,
} from '../models';
import { asyncHandler } from '../utils/asyncHandler';
import { parsePagination, searchFilter } from '../utils/pagination';
import { sendCreated, sendPaginated, sendSuccess } from '../utils/response';
import { ApiError } from '../utils/ApiError';
import { nextDocumentNumber } from '../utils/sequence';
import { postPaymentJournal, voidJournalByReference } from '../services/accounting.service';
import {
  recalculateInvoiceStatus,
  updateCustomerBalance,
  updateInvoicePayment,
} from '../services/sales.service';
import { createNotification } from '../services/notification.service';
import { round2 } from '../utils/money';

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

export const paymentController = {
  list: asyncHandler(async (req, res) => {
    const pagination = parsePagination(req.query as Record<string, unknown>, {
      defaultSort: '-date',
    });
    const filter: Record<string, unknown> = {
      organization: req.organizationId,
      ...searchFilter(pagination.search, ['number', 'reference', 'notes']),
    };
    if (req.query.type) filter.type = req.query.type;
    if (req.query.customer) filter.customer = req.query.customer;
    if (req.query.supplier) filter.supplier = req.query.supplier;
    if (req.query.method) filter.method = req.query.method;
    const [items, total] = await Promise.all([
      Payment.find(filter)
        .populate('customer', 'name company')
        .populate('supplier', 'name company')
        .populate('invoice', 'number total balance status')
        .populate('bill', 'number total balance status')
        .sort(pagination.sort)
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      Payment.countDocuments(filter),
    ]);
    return sendPaginated(res, items, pagination.meta(total));
  }),

  get: asyncHandler(async (req, res) => {
    const payment = await Payment.findOne({
      _id: req.params.id,
      organization: req.organizationId,
    })
      .populate('customer', 'name company email')
      .populate('supplier', 'name company email')
      .populate('invoice', 'number total balance status')
      .populate('bill', 'number total balance status')
      .lean();
    if (!payment) throw ApiError.notFound('Payment');
    return sendSuccess(res, payment);
  }),

  create: asyncHandler(async (req, res) => {
    const organization = await Organization.findById(req.organizationId).lean();
    if (!organization) throw ApiError.notFound('Organization');
    const body = req.body as Record<string, unknown>;
    const amount = round2(Number(body.amount));
    if (!(amount > 0)) throw ApiError.validation('Payment amount must be greater than zero');

    let customerId: Types.ObjectId | undefined;
    let supplierId: Types.ObjectId | undefined;
    let invoiceId: Types.ObjectId | undefined;
    let billId: Types.ObjectId | undefined;

    if (body.type === 'receivable') {
      if (body.invoice) {
        const invoice = await Invoice.findOne({
          _id: body.invoice,
          organization: req.organizationId,
        });
        if (!invoice) throw ApiError.validation('Invoice not found');
        if (invoice.status === 'void') throw ApiError.validation('Cannot pay a void invoice');
        if (invoice.status === 'draft') throw ApiError.validation('Issue the invoice before recording payments');
        if (amount > invoice.balance + 0.009) {
          throw ApiError.validation(`Payment exceeds the outstanding balance of ${invoice.balance}`);
        }
        invoiceId = invoice._id;
        customerId = invoice.customer;
      } else if (body.customer) {
        const customer = await Customer.exists({
          _id: body.customer,
          organization: req.organizationId,
        });
        if (!customer) throw ApiError.validation('Customer not found');
        customerId = new Types.ObjectId(String(body.customer));
      }
      if (!customerId) throw ApiError.validation('Customer or invoice is required');
    } else {
      if (body.bill) {
        const bill = await Bill.findOne({ _id: body.bill, organization: req.organizationId });
        if (!bill) throw ApiError.validation('Bill not found');
        if (bill.status === 'void') throw ApiError.validation('Cannot pay a void bill');
        if (bill.status === 'draft') throw ApiError.validation('Open the bill before recording payments');
        if (amount > bill.balance + 0.009) {
          throw ApiError.validation(`Payment exceeds the outstanding balance of ${bill.balance}`);
        }
        billId = bill._id;
        supplierId = bill.supplier;
      } else if (body.supplier) {
        const supplier = await Supplier.exists({
          _id: body.supplier,
          organization: req.organizationId,
        });
        if (!supplier) throw ApiError.validation('Vendor not found');
        supplierId = new Types.ObjectId(String(body.supplier));
      }
      if (!supplierId) throw ApiError.validation('Vendor or bill is required');
    }

    const prefix = body.type === 'receivable' ? 'RCP' : 'PAY';
    const number = await nextDocumentNumber(
      new Types.ObjectId(req.organizationId),
      body.type === 'receivable' ? 'receipt' : 'vendor_payment',
      prefix,
    );

    const payment = await Payment.create({
      organization: req.organizationId!,
      number,
      type: body.type as 'receivable' | 'payable',
      customer: customerId,
      supplier: supplierId,
      invoice: invoiceId,
      bill: billId,
      amount,
      currency: organization.settings?.currency ?? 'USD',
      method: (body.method ?? 'bank') as 'cash' | 'bank' | 'card' | 'cheque' | 'online' | 'other',
      reference: body.reference as string | undefined,
      date: body.date ? new Date(String(body.date)) : new Date(),
      notes: body.notes as string | undefined,
      createdBy: req.user?.id,
    });

    if (body.type === 'receivable') {
      if (invoiceId) await updateInvoicePayment(invoiceId, amount, 1);
      if (customerId) await updateCustomerBalance(customerId, -amount);
    } else {
      if (billId) {
        const bill = await Bill.findById(billId);
        if (bill) {
          bill.amountPaid = round2(bill.amountPaid + amount);
          bill.balance = round2(Math.max(0, bill.total - bill.amountPaid));
          await bill.save();
          await refreshBillStatus(bill._id);
        }
      }
      if (supplierId) {
        await Supplier.updateOne({ _id: supplierId }, { $inc: { balance: -amount } });
      }
    }

    await postPaymentJournal(payment);
    await createNotification({
      organization: payment.organization,
      type: 'success',
      title: 'Payment recorded',
      message: `${payment.number} for ${payment.currency} ${amount.toFixed(2)} was recorded.`,
      link: payment.type === 'receivable' ? '/sales/invoices' : '/purchases/bills',
    });
    return sendCreated(res, payment.toJSON());
  }),

  remove: asyncHandler(async (req, res) => {
    const payment = await Payment.findOne({
      _id: req.params.id,
      organization: req.organizationId,
    });
    if (!payment) throw ApiError.notFound('Payment');

    if (payment.type === 'receivable') {
      if (payment.invoice) await updateInvoicePayment(payment.invoice, payment.amount, -1);
      if (payment.customer) await updateCustomerBalance(payment.customer, payment.amount);
    } else {
      if (payment.bill) {
        const bill = await Bill.findById(payment.bill);
        if (bill) {
          bill.amountPaid = round2(Math.max(0, bill.amountPaid - payment.amount));
          bill.balance = round2(Math.max(0, bill.total - bill.amountPaid));
          await bill.save();
          await refreshBillStatus(bill._id);
        }
      }
      if (payment.supplier) {
        await Supplier.updateOne({ _id: payment.supplier }, { $inc: { balance: payment.amount } });
      }
    }
    await voidJournalByReference(payment.organization, 'payment', payment._id);
    await payment.softDelete();
    return sendSuccess(res, { id: req.params.id, deleted: true });
  }),
};

export { refreshBillStatus, recalculateInvoiceStatus };
