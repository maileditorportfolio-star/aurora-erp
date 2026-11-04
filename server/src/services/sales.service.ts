import { Types } from 'mongoose';
import {
  Customer,
  Invoice,
  Product,
  Quotation,
  SalesOrder,
  type IDocumentLine,
} from '../models';
import { ApiError } from '../utils/ApiError';
import { calculateTotals, round2 } from '../utils/money';
import { nextDocumentNumber } from '../utils/sequence';
import { commitReservation, issueStock, releaseReservation, reserveStock } from './inventory.service';

interface RawLine {
  product?: string | null;
  description: string;
  quantity: number;
  unitPrice?: number;
  unitCost?: number;
  discountRate?: number;
  taxRate?: number;
}

export async function buildDocumentLines(
  organization: Types.ObjectId | string,
  rawLines: RawLine[],
  priceField: 'unitPrice' | 'unitCost' = 'unitPrice',
): Promise<{ lines: IDocumentLine[]; totals: ReturnType<typeof calculateTotals> }> {
  if (!rawLines?.length) throw ApiError.validation('At least one line item is required');
  const productIds = rawLines
    .map((line) => line.product)
    .filter((id): id is string => Boolean(id) && Types.ObjectId.isValid(String(id)));
  const products = productIds.length
    ? await Product.find({ _id: { $in: productIds }, organization }).lean()
    : [];
  const byId = new Map(products.map((product) => [String(product._id), product]));

  const prepared = rawLines.map((line) => {
    const product = line.product ? byId.get(String(line.product)) : undefined;
    if (line.product && !product) throw ApiError.validation('One or more products could not be found');
    const fallbackPrice =
      priceField === 'unitCost' ? product?.costPrice ?? 0 : product?.sellingPrice ?? 0;
    return {
      product: line.product ?? undefined,
      description: line.description || product?.name || 'Item',
      quantity: Number(line.quantity),
      unitPrice: Number(line[priceField] ?? fallbackPrice) || fallbackPrice,
      unitCost: Number(line.unitCost ?? product?.costPrice ?? 0),
      discountRate: Number(line.discountRate ?? 0),
      taxRate: Number(line.taxRate ?? product?.taxRate ?? 0),
    };
  });

  const totals = calculateTotals(prepared);
  const lines = prepared.map((line, index) => {
    const calculated = totals.lines[index]!;
    return {
      product: line.product,
      description: line.description,
      quantity: calculated.quantity,
      unitPrice: line.unitPrice,
      unitCost: line.unitCost,
      discountRate: calculated.discountRate,
      taxRate: calculated.taxRate,
      discount: calculated.discount,
      tax: calculated.tax,
      total: calculated.total,
    } as unknown as IDocumentLine;
  });
  return { lines, totals };
}

export async function prefixFor(
  organization: { settings?: { quotationPrefix?: string; salesOrderPrefix?: string; purchaseOrderPrefix?: string; invoicePrefix?: string } },
  key: 'quotationPrefix' | 'salesOrderPrefix' | 'purchaseOrderPrefix' | 'invoicePrefix',
  fallback: string,
): Promise<string> {
  return organization.settings?.[key] || fallback;
}

export async function reserveOrderStock(
  order: {
    organization: Types.ObjectId;
    warehouse?: Types.ObjectId | null;
    number: string;
    _id: Types.ObjectId;
    items: Array<{ product?: Types.ObjectId | null; quantity: number }>;
  },
  userId?: Types.ObjectId,
) {
  const products = await Product.find({
    _id: { $in: order.items.map((item) => item.product).filter(Boolean) },
    organization: order.organization,
  }).lean();
  const byId = new Map(products.map((product) => [String(product._id), product]));
  for (const item of order.items) {
    if (!item.product) continue;
    const product = byId.get(String(item.product));
    if (!product || !product.trackInventory || product.type === 'service') continue;
    await reserveStock({
      organization: order.organization,
      productId: product._id,
      warehouseId: order.warehouse,
      quantity: item.quantity,
      reference: { type: 'sales_order', id: order._id, number: order.number },
      userId,
    });
  }
}

export async function releaseOrderStock(
  order: {
    organization: Types.ObjectId;
    warehouse?: Types.ObjectId | null;
    number: string;
    _id: Types.ObjectId;
    items: Array<{ product?: Types.ObjectId | null; quantity: number }>;
  },
  userId?: Types.ObjectId,
) {
  const products = await Product.find({
    _id: { $in: order.items.map((item) => item.product).filter(Boolean) },
    organization: order.organization,
  }).lean();
  const trackable = new Set(
    products.filter((product) => product.trackInventory && product.type === 'goods').map((p) => String(p._id)),
  );
  for (const item of order.items) {
    if (!item.product || !trackable.has(String(item.product))) continue;
    await releaseReservation({
      organization: order.organization,
      productId: item.product,
      warehouseId: order.warehouse,
      quantity: item.quantity,
      reference: { type: 'sales_order', id: order._id, number: order.number },
      userId,
    });
  }
}

export async function issueInvoiceStock(
  invoice: {
    organization: Types.ObjectId;
    warehouse?: Types.ObjectId | null;
    number: string;
    _id: Types.ObjectId;
    items: Array<{ product?: Types.ObjectId | null; quantity: number }>;
  },
  options: { reserved: boolean; reverse?: boolean; userId?: Types.ObjectId },
) {
  const productIds = invoice.items.map((item) => item.product).filter(Boolean);
  const products = productIds.length
    ? await Product.find({
        _id: { $in: productIds },
        organization: invoice.organization,
      }).lean()
    : [];
  const trackable = new Set(
    products.filter((product) => product.trackInventory && product.type === 'goods').map((p) => String(p._id)),
  );

  for (const item of invoice.items) {
    if (!item.product || !trackable.has(String(item.product))) continue;
    if (options.reverse) {
      const { receiveStock } = await import('./inventory.service');
      await receiveStock({
        organization: invoice.organization,
        productId: item.product,
        warehouseId: invoice.warehouse,
        quantity: item.quantity,
        note: `Void invoice ${invoice.number}`,
        reference: { type: 'invoice_void', id: invoice._id, number: invoice.number },
        userId: options.userId,
      });
      continue;
    }
    if (options.reserved) {
      await commitReservation({
        organization: invoice.organization,
        productId: item.product,
        warehouseId: invoice.warehouse,
        quantity: item.quantity,
        reference: { type: 'invoice', id: invoice._id, number: invoice.number },
        userId: options.userId,
      });
    } else {
      await issueStock({
        organization: invoice.organization,
        productId: item.product,
        warehouseId: invoice.warehouse,
        quantity: item.quantity,
        note: `Invoice ${invoice.number}`,
        reference: { type: 'invoice', id: invoice._id, number: invoice.number },
        userId: options.userId,
      });
    }
  }
}

export async function recalculateInvoiceStatus(invoice: {
  _id: Types.ObjectId;
  total: number;
  amountPaid: number;
  dueDate: Date;
  status: string;
}) {
  if (invoice.status === 'void') return invoice.status;
  const balance = round2(invoice.total - invoice.amountPaid);
  if (balance <= 0.009) return 'paid';
  if (invoice.amountPaid > 0) return 'partial';
  if (invoice.dueDate.getTime() < Date.now()) return 'overdue';
  return invoice.status === 'draft' ? 'draft' : 'sent';
}

export async function createSalesOrderFromQuotation(
  quotation: InstanceType<typeof Quotation>,
  userId?: Types.ObjectId,
) {
  const organization = quotation.organization;
  const org = await import('../models/core').then(({ Organization }) =>
    Organization.findById(organization).lean(),
  );
  const prefix = await prefixFor(org ?? {}, 'salesOrderPrefix', 'SO');
  const number = await nextDocumentNumber(organization, 'sales_order', prefix);
  const order = await SalesOrder.create({
    organization,
    number,
    customer: quotation.customer,
    quotation: quotation._id,
    date: new Date(),
    warehouse: undefined,
    items: quotation.items,
    subtotal: quotation.subtotal,
    discountTotal: quotation.discountTotal,
    taxTotal: quotation.taxTotal,
    total: quotation.total,
    status: 'pending',
    notes: quotation.notes,
    createdBy: userId,
  });
  quotation.status = 'converted';
  quotation.convertedOrder = order._id;
  await quotation.save();
  return order;
}

export async function updateCustomerBalance(customerId: Types.ObjectId, delta: number) {
  await Customer.updateOne({ _id: customerId }, { $inc: { balance: round2(delta) } });
}

export async function updateInvoicePayment(
  invoiceId: Types.ObjectId,
  amount: number,
  direction: 1 | -1 = 1,
) {
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) throw ApiError.notFound('Invoice');
  invoice.amountPaid = round2(Math.max(0, invoice.amountPaid + amount * direction));
  invoice.balance = round2(Math.max(0, invoice.total - invoice.amountPaid));
  invoice.status = (await recalculateInvoiceStatus({
    _id: invoice._id,
    total: invoice.total,
    amountPaid: invoice.amountPaid,
    dueDate: invoice.dueDate,
    status: invoice.status,
  })) as typeof invoice.status;
  await invoice.save();
  return invoice;
}
