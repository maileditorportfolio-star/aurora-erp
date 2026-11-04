import mongoose, { Schema, type HydratedDocument, type Types } from 'mongoose';
import { applyTenantSoftDelete, moneyField, schemaOptions, type SoftDeleteFields } from './helpers';
import { documentLineSchema, type IDocumentLine } from './lineItems';

/* ───────────────────────────── Purchase Order ───────────────────────────── */

export type PurchaseOrderStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'sent'
  | 'partial'
  | 'received'
  | 'cancelled';

export interface IPurchaseOrder extends SoftDeleteFields {
  organization: Types.ObjectId;
  number: string;
  supplier: Types.ObjectId;
  date: Date;
  expectedDate?: Date;
  warehouse?: Types.ObjectId | null;
  items: IDocumentLine[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  status: PurchaseOrderStatus;
  notes?: string;
  terms?: string;
  createdBy?: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const purchaseOrderSchema = new Schema<IPurchaseOrder>(
  {
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    number: { type: String, required: true },
    supplier: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true },
    date: { type: Date, default: Date.now },
    expectedDate: Date,
    warehouse: { type: Schema.Types.ObjectId, ref: 'Warehouse', default: null },
    items: { type: [documentLineSchema], validate: (v: IDocumentLine[]) => v.length > 0 },
    subtotal: moneyField(),
    discountTotal: moneyField(),
    taxTotal: moneyField(),
    total: moneyField(),
    status: {
      type: String,
      enum: ['draft', 'pending', 'approved', 'sent', 'partial', 'received', 'cancelled'],
      default: 'draft',
      index: true,
    },
    notes: String,
    terms: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  schemaOptions,
);

purchaseOrderSchema.index({ organization: 1, number: 1 }, { unique: true });
purchaseOrderSchema.index({ organization: 1, supplier: 1, status: 1 });
purchaseOrderSchema.index({ organization: 1, date: -1 });
applyTenantSoftDelete(purchaseOrderSchema);

export const PurchaseOrder = mongoose.model<IPurchaseOrder>('PurchaseOrder', purchaseOrderSchema);
export type PurchaseOrderDocument = HydratedDocument<IPurchaseOrder>;

/* ─────────────────────────────── Goods Receipt ──────────────────────────── */

export interface IGoodsReceiptLine {
  product: Types.ObjectId;
  description?: string;
  orderedQty: number;
  receivedQty: number;
  acceptedQty: number;
  rejectedQty: number;
  unitCost: number;
  total: number;
}

export interface IGoodsReceipt extends SoftDeleteFields {
  organization: Types.ObjectId;
  number: string;
  purchaseOrder: Types.ObjectId;
  supplier: Types.ObjectId;
  warehouse: Types.ObjectId;
  receivedDate: Date;
  items: IGoodsReceiptLine[];
  total: number;
  status: 'draft' | 'received' | 'cancelled';
  notes?: string;
  stockApplied: boolean;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const goodsReceiptLineSchema = new Schema<IGoodsReceiptLine>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    description: String,
    orderedQty: { type: Number, default: 0, min: 0 },
    receivedQty: { type: Number, required: true, min: 0 },
    acceptedQty: { type: Number, required: true, min: 0 },
    rejectedQty: { type: Number, default: 0, min: 0 },
    unitCost: { type: Number, default: 0, min: 0 },
    total: { type: Number, default: 0, min: 0 },
  },
  { _id: true },
);

const goodsReceiptSchema = new Schema<IGoodsReceipt>(
  {
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    number: { type: String, required: true },
    purchaseOrder: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder', required: true },
    supplier: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
    warehouse: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    receivedDate: { type: Date, default: Date.now },
    items: { type: [goodsReceiptLineSchema], validate: (v: IGoodsReceiptLine[]) => v.length > 0 },
    total: moneyField(),
    status: { type: String, enum: ['draft', 'received', 'cancelled'], default: 'draft' },
    notes: String,
    stockApplied: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  schemaOptions,
);

goodsReceiptSchema.index({ organization: 1, number: 1 }, { unique: true });
goodsReceiptSchema.index({ organization: 1, purchaseOrder: 1 });
applyTenantSoftDelete(goodsReceiptSchema);

export const GoodsReceipt = mongoose.model<IGoodsReceipt>('GoodsReceipt', goodsReceiptSchema);
export type GoodsReceiptDocument = HydratedDocument<IGoodsReceipt>;

/* ─────────────────────────────────── Bill ───────────────────────────────── */

export type BillStatus = 'draft' | 'open' | 'partial' | 'paid' | 'overdue' | 'void';

export interface IBill extends SoftDeleteFields {
  organization: Types.ObjectId;
  number: string;
  supplier: Types.ObjectId;
  purchaseOrder?: Types.ObjectId | null;
  goodsReceipt?: Types.ObjectId | null;
  issueDate: Date;
  dueDate: Date;
  items: IDocumentLine[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  amountPaid: number;
  balance: number;
  status: BillStatus;
  notes?: string;
  voidedAt?: Date;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const billSchema = new Schema<IBill>(
  {
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    number: { type: String, required: true },
    supplier: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true },
    purchaseOrder: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder', default: null },
    goodsReceipt: { type: Schema.Types.ObjectId, ref: 'GoodsReceipt', default: null },
    issueDate: { type: Date, default: Date.now },
    dueDate: { type: Date, required: true },
    items: { type: [documentLineSchema], default: [] },
    subtotal: moneyField(),
    discountTotal: moneyField(),
    taxTotal: moneyField(),
    total: moneyField(),
    amountPaid: moneyField(),
    balance: moneyField(),
    status: {
      type: String,
      enum: ['draft', 'open', 'partial', 'paid', 'overdue', 'void'],
      default: 'open',
      index: true,
    },
    notes: String,
    voidedAt: Date,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  schemaOptions,
);

billSchema.index({ organization: 1, number: 1 }, { unique: true });
billSchema.index({ organization: 1, supplier: 1, status: 1 });
billSchema.index({ organization: 1, dueDate: 1, status: 1 });
applyTenantSoftDelete(billSchema);

export const Bill = mongoose.model<IBill>('Bill', billSchema);
export type BillDocument = HydratedDocument<IBill>;
