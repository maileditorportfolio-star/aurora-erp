import mongoose, { Schema, type HydratedDocument, type Types } from 'mongoose';
import { applyTenantSoftDelete, moneyField, schemaOptions, type SoftDeleteFields } from './helpers';
import { documentLineSchema, type IDocumentLine } from './lineItems';
import { addressSchema } from './inventory';

/* ──────────────────────────────── Customer ──────────────────────────────── */

export interface ICustomer extends SoftDeleteFields {
  organization: Types.ObjectId;
  name: string;
  code?: string;
  company?: string;
  email?: string;
  phone?: string;
  billingAddress?: Record<string, string | undefined>;
  shippingAddress?: Record<string, string | undefined>;
  taxId?: string;
  creditLimit: number;
  balance: number;
  currency: string;
  status: 'active' | 'inactive' | 'blocked';
  notes?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new Schema<ICustomer>(
  {
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    code: { type: String, trim: true, uppercase: true },
    company: String,
    email: { type: String, lowercase: true, trim: true },
    phone: String,
    billingAddress: addressSchema,
    shippingAddress: addressSchema,
    taxId: String,
    creditLimit: moneyField(),
    balance: moneyField(),
    currency: { type: String, default: 'USD', uppercase: true },
    status: { type: String, enum: ['active', 'inactive', 'blocked'], default: 'active' },
    notes: { type: String, maxlength: 2000 },
    tags: { type: [String], default: [] },
  },
  schemaOptions,
);

customerSchema.index({ organization: 1, name: 1 });
customerSchema.index({ organization: 1, email: 1 });
customerSchema.index({ organization: 1, code: 1 }, { sparse: true });
applyTenantSoftDelete(customerSchema);

export const Customer = mongoose.model<ICustomer>('Customer', customerSchema);
export type CustomerDocument = HydratedDocument<ICustomer>;

/* ─────────────────────────────── Quotation ──────────────────────────────── */

export type QuotationStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'converted';

export interface IQuotation extends SoftDeleteFields {
  organization: Types.ObjectId;
  number: string;
  customer: Types.ObjectId;
  date: Date;
  validUntil: Date;
  items: IDocumentLine[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  status: QuotationStatus;
  notes?: string;
  terms?: string;
  convertedOrder?: Types.ObjectId;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const quotationSchema = new Schema<IQuotation>(
  {
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    number: { type: String, required: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    date: { type: Date, default: Date.now },
    validUntil: { type: Date, required: true },
    items: { type: [documentLineSchema], validate: (v: IDocumentLine[]) => v.length > 0 },
    subtotal: moneyField(),
    discountTotal: moneyField(),
    taxTotal: moneyField(),
    total: moneyField(),
    status: {
      type: String,
      enum: ['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted'],
      default: 'draft',
      index: true,
    },
    notes: String,
    terms: String,
    convertedOrder: { type: Schema.Types.ObjectId, ref: 'SalesOrder' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  schemaOptions,
);

quotationSchema.index({ organization: 1, number: 1 }, { unique: true });
quotationSchema.index({ organization: 1, customer: 1, status: 1 });
quotationSchema.index({ organization: 1, date: -1 });
applyTenantSoftDelete(quotationSchema);

export const Quotation = mongoose.model<IQuotation>('Quotation', quotationSchema);
export type QuotationDocument = HydratedDocument<IQuotation>;

/* ─────────────────────────────── SalesOrder ─────────────────────────────── */

export type SalesOrderStatus =
  | 'draft'
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export interface ISalesOrder extends SoftDeleteFields {
  organization: Types.ObjectId;
  number: string;
  customer: Types.ObjectId;
  quotation?: Types.ObjectId | null;
  date: Date;
  deliveryDate?: Date;
  warehouse?: Types.ObjectId | null;
  items: IDocumentLine[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  status: SalesOrderStatus;
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  stockReserved: boolean;
  notes?: string;
  createdBy?: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const salesOrderSchema = new Schema<ISalesOrder>(
  {
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    number: { type: String, required: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    quotation: { type: Schema.Types.ObjectId, ref: 'Quotation', default: null },
    date: { type: Date, default: Date.now },
    deliveryDate: Date,
    warehouse: { type: Schema.Types.ObjectId, ref: 'Warehouse', default: null },
    items: { type: [documentLineSchema], validate: (v: IDocumentLine[]) => v.length > 0 },
    subtotal: moneyField(),
    discountTotal: moneyField(),
    taxTotal: moneyField(),
    total: moneyField(),
    status: {
      type: String,
      enum: ['draft', 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
      default: 'draft',
      index: true,
    },
    paymentStatus: { type: String, enum: ['unpaid', 'partial', 'paid'], default: 'unpaid' },
    stockReserved: { type: Boolean, default: false },
    notes: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  schemaOptions,
);

salesOrderSchema.index({ organization: 1, number: 1 }, { unique: true });
salesOrderSchema.index({ organization: 1, customer: 1, status: 1 });
salesOrderSchema.index({ organization: 1, date: -1 });
applyTenantSoftDelete(salesOrderSchema);

export const SalesOrder = mongoose.model<ISalesOrder>('SalesOrder', salesOrderSchema);
export type SalesOrderDocument = HydratedDocument<ISalesOrder>;

/* ───────────────────────────────── Invoice ──────────────────────────────── */

export type InvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'overdue' | 'void';

export interface IInvoice extends SoftDeleteFields {
  organization: Types.ObjectId;
  number: string;
  customer: Types.ObjectId;
  salesOrder?: Types.ObjectId | null;
  quotation?: Types.ObjectId | null;
  issueDate: Date;
  dueDate: Date;
  warehouse?: Types.ObjectId | null;
  items: IDocumentLine[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  amountPaid: number;
  balance: number;
  status: InvoiceStatus;
  notes?: string;
  terms?: string;
  sentAt?: Date;
  voidedAt?: Date;
  voidReason?: string;
  stockIssued: boolean;
  journalPosted: boolean;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const invoiceSchema = new Schema<IInvoice>(
  {
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    number: { type: String, required: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    salesOrder: { type: Schema.Types.ObjectId, ref: 'SalesOrder', default: null },
    quotation: { type: Schema.Types.ObjectId, ref: 'Quotation', default: null },
    issueDate: { type: Date, default: Date.now },
    dueDate: { type: Date, required: true },
    warehouse: { type: Schema.Types.ObjectId, ref: 'Warehouse', default: null },
    items: { type: [documentLineSchema], validate: (v: IDocumentLine[]) => v.length > 0 },
    subtotal: moneyField(),
    discountTotal: moneyField(),
    taxTotal: moneyField(),
    total: moneyField(),
    amountPaid: moneyField(),
    balance: moneyField(),
    status: {
      type: String,
      enum: ['draft', 'sent', 'partial', 'paid', 'overdue', 'void'],
      default: 'draft',
      index: true,
    },
    notes: String,
    terms: String,
    sentAt: Date,
    voidedAt: Date,
    voidReason: String,
    stockIssued: { type: Boolean, default: false },
    journalPosted: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  schemaOptions,
);

invoiceSchema.index({ organization: 1, number: 1 }, { unique: true });
invoiceSchema.index({ organization: 1, customer: 1, status: 1 });
invoiceSchema.index({ organization: 1, issueDate: -1 });
invoiceSchema.index({ organization: 1, dueDate: 1, status: 1 });
applyTenantSoftDelete(invoiceSchema);

export const Invoice = mongoose.model<IInvoice>('Invoice', invoiceSchema);
export type InvoiceDocument = HydratedDocument<IInvoice>;

/* ───────────────────────────────── Payment ──────────────────────────────── */

export interface IPayment extends SoftDeleteFields {
  organization: Types.ObjectId;
  number: string;
  type: 'receivable' | 'payable';
  customer?: Types.ObjectId | null;
  supplier?: Types.ObjectId | null;
  invoice?: Types.ObjectId | null;
  bill?: Types.ObjectId | null;
  amount: number;
  currency: string;
  method: 'cash' | 'bank' | 'card' | 'cheque' | 'online' | 'other';
  reference?: string;
  date: Date;
  notes?: string;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    number: { type: String, required: true },
    type: { type: String, enum: ['receivable', 'payable'], required: true, index: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
    supplier: { type: Schema.Types.ObjectId, ref: 'Supplier', default: null },
    invoice: { type: Schema.Types.ObjectId, ref: 'Invoice', default: null },
    bill: { type: Schema.Types.ObjectId, ref: 'Bill', default: null },
    amount: { type: Number, required: true, min: 0.01 },
    currency: { type: String, default: 'USD', uppercase: true },
    method: {
      type: String,
      enum: ['cash', 'bank', 'card', 'cheque', 'online', 'other'],
      default: 'bank',
    },
    reference: String,
    date: { type: Date, default: Date.now },
    notes: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  schemaOptions,
);

paymentSchema.index({ organization: 1, number: 1 }, { unique: true });
paymentSchema.index({ organization: 1, date: -1 });
paymentSchema.index({ organization: 1, invoice: 1 });
applyTenantSoftDelete(paymentSchema);

export const Payment = mongoose.model<IPayment>('Payment', paymentSchema);
export type PaymentDocument = HydratedDocument<IPayment>;
