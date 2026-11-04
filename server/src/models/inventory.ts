import mongoose, { Schema, type HydratedDocument, type Types } from 'mongoose';
import {
  applyTenant,
  applyTenantSoftDelete,
  moneyField,
  schemaOptions,
  type SoftDeleteFields,
} from './helpers';

const addressSchema = new Schema(
  {
    street: String,
    city: String,
    state: String,
    country: String,
    postalCode: String,
  },
  { _id: false },
);

/* ──────────────────────────────── Category ──────────────────────────────── */

export interface ICategory extends SoftDeleteFields {
  organization: Types.ObjectId;
  name: string;
  code?: string;
  description?: string;
  parent?: Types.ObjectId | null;
  color?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<ICategory>(
  {
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    code: { type: String, trim: true, uppercase: true },
    description: { type: String, maxlength: 1000 },
    parent: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    color: { type: String, default: '#6366f1' },
    isActive: { type: Boolean, default: true },
  },
  schemaOptions,
);

categorySchema.index({ organization: 1, name: 1 }, { unique: true });
categorySchema.index({ organization: 1, parent: 1 });
applyTenantSoftDelete(categorySchema);

export const Category = mongoose.model<ICategory>('Category', categorySchema);

/* ─────────────────────────────── Warehouse ──────────────────────────────── */

export interface IWarehouse extends SoftDeleteFields {
  organization: Types.ObjectId;
  name: string;
  code: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  manager?: string;
  phone?: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const warehouseSchema = new Schema<IWarehouse>(
  {
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    code: { type: String, required: true, trim: true, uppercase: true },
    address: addressSchema,
    manager: String,
    phone: String,
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  schemaOptions,
);

warehouseSchema.index({ organization: 1, code: 1 }, { unique: true });
applyTenantSoftDelete(warehouseSchema);

export const Warehouse = mongoose.model<IWarehouse>('Warehouse', warehouseSchema);
export type WarehouseDocument = HydratedDocument<IWarehouse>;

/* ──────────────────────────────── Supplier ──────────────────────────────── */

export interface ISupplier extends SoftDeleteFields {
  organization: Types.ObjectId;
  name: string;
  code?: string;
  company?: string;
  email?: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  taxId?: string;
  paymentTerms: number;
  currency: string;
  openingBalance: number;
  balance: number;
  status: 'active' | 'inactive' | 'blocked';
  notes?: string;
  tags: string[];
  bankDetails?: {
    bankName?: string;
    accountName?: string;
    accountNumber?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const supplierSchema = new Schema<ISupplier>(
  {
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    code: { type: String, trim: true, uppercase: true },
    company: String,
    email: { type: String, lowercase: true, trim: true },
    phone: String,
    address: addressSchema,
    taxId: String,
    paymentTerms: { type: Number, default: 30, min: 0 },
    currency: { type: String, default: 'USD', uppercase: true },
    openingBalance: moneyField(),
    balance: moneyField(),
    status: { type: String, enum: ['active', 'inactive', 'blocked'], default: 'active' },
    notes: { type: String, maxlength: 2000 },
    tags: { type: [String], default: [] },
    bankDetails: {
      bankName: String,
      accountName: String,
      accountNumber: String,
    },
  },
  schemaOptions,
);

supplierSchema.index({ organization: 1, name: 1 });
supplierSchema.index({ organization: 1, email: 1 });
supplierSchema.index({ organization: 1, code: 1 }, { sparse: true });
applyTenantSoftDelete(supplierSchema);

export const Supplier = mongoose.model<ISupplier>('Supplier', supplierSchema);
export type SupplierDocument = HydratedDocument<ISupplier>;

/* ───────────────────────────────── Product ──────────────────────────────── */

export interface IProduct extends SoftDeleteFields {
  organization: Types.ObjectId;
  name: string;
  sku: string;
  barcode?: string;
  description?: string;
  category?: Types.ObjectId | null;
  supplier?: Types.ObjectId | null;
  warehouse?: Types.ObjectId | null;
  type: 'goods' | 'service';
  unit: string;
  costPrice: number;
  sellingPrice: number;
  taxRate: number;
  stock: number;
  reserved: number;
  reorderPoint: number;
  reorderQty: number;
  trackInventory: boolean;
  status: 'active' | 'inactive' | 'discontinued';
  imageUrl?: string;
  tags: string[];
  isLowStock?: boolean;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<IProduct>(
  {
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 180 },
    sku: { type: String, required: true, trim: true, uppercase: true },
    barcode: { type: String, trim: true },
    description: { type: String, maxlength: 4000 },
    category: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    supplier: { type: Schema.Types.ObjectId, ref: 'Supplier', default: null },
    warehouse: { type: Schema.Types.ObjectId, ref: 'Warehouse', default: null },
    type: { type: String, enum: ['goods', 'service'], default: 'goods' },
    unit: { type: String, default: 'pcs' },
    costPrice: moneyField(),
    sellingPrice: moneyField(),
    taxRate: { type: Number, default: 0, min: 0, max: 100 },
    stock: { type: Number, default: 0 },
    reserved: { type: Number, default: 0, min: 0 },
    reorderPoint: { type: Number, default: 0, min: 0 },
    reorderQty: { type: Number, default: 0, min: 0 },
    trackInventory: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ['active', 'inactive', 'discontinued'],
      default: 'active',
    },
    imageUrl: String,
    tags: { type: [String], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  schemaOptions,
);

productSchema.index({ organization: 1, sku: 1 }, { unique: true });
productSchema.index({ organization: 1, barcode: 1 }, { sparse: true });
productSchema.index({ organization: 1, name: 1 });
productSchema.index({ organization: 1, stock: 1, reorderPoint: 1 });
productSchema.index({ organization: 1, category: 1, status: 1 });

productSchema.virtual('isLowStock').get(function (this: IProduct) {
  return this.trackInventory && this.stock <= this.reorderPoint;
});
productSchema.virtual('availableStock').get(function (this: IProduct) {
  return Math.max(0, this.stock - this.reserved);
});

applyTenantSoftDelete(productSchema);

export const Product = mongoose.model<IProduct>('Product', productSchema);
export type ProductDocument = HydratedDocument<IProduct>;

/* ─────────────────────────────── StockLevel ─────────────────────────────── */

export interface IStockLevel {
  organization: Types.ObjectId;
  product: Types.ObjectId;
  warehouse: Types.ObjectId;
  quantity: number;
  reserved: number;
  reorderPoint: number;
  updatedAt: Date;
}

const stockLevelSchema = new Schema<IStockLevel>(
  {
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    warehouse: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true, index: true },
    quantity: { type: Number, default: 0 },
    reserved: { type: Number, default: 0, min: 0 },
    reorderPoint: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, versionKey: false },
);

stockLevelSchema.index({ organization: 1, product: 1, warehouse: 1 }, { unique: true });
applyTenant(stockLevelSchema);

export const StockLevel = mongoose.model<IStockLevel>('StockLevel', stockLevelSchema);

/* ────────────────────────────── StockMovement ───────────────────────────── */

export interface IStockMovement {
  organization: Types.ObjectId;
  product: Types.ObjectId;
  warehouse: Types.ObjectId;
  type:
    | 'receipt'
    | 'issue'
    | 'adjustment'
    | 'transfer_in'
    | 'transfer_out'
    | 'reservation'
    | 'release';
  quantity: number;
  direction: 'in' | 'out';
  referenceType?: string;
  referenceId?: Types.ObjectId;
  referenceNumber?: string;
  note?: string;
  balanceAfter: number;
  createdBy?: Types.ObjectId;
  createdAt: Date;
}

const stockMovementSchema = new Schema<IStockMovement>(
  {
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    warehouse: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true, index: true },
    type: {
      type: String,
      enum: [
        'receipt',
        'issue',
        'adjustment',
        'transfer_in',
        'transfer_out',
        'reservation',
        'release',
      ],
      required: true,
    },
    quantity: { type: Number, required: true },
    direction: { type: String, enum: ['in', 'out'], required: true },
    referenceType: String,
    referenceId: Schema.Types.ObjectId,
    referenceNumber: String,
    note: String,
    balanceAfter: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

stockMovementSchema.index({ organization: 1, product: 1, createdAt: -1 });
stockMovementSchema.index({ organization: 1, warehouse: 1, createdAt: -1 });
applyTenant(stockMovementSchema);

export const StockMovement = mongoose.model<IStockMovement>('StockMovement', stockMovementSchema);

export { addressSchema };
