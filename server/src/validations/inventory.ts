import { z } from 'zod';
import { addressSchema, objectId, optionalObjectId, paginationSchema } from './common';

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().max(20).optional(),
  description: z.string().max(1000).optional(),
  parent: optionalObjectId,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  isActive: z.boolean().optional(),
});
export const categoryUpdateSchema = categoryCreateSchema.partial();

export const warehouseCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().min(1).max(20),
  address: addressSchema,
  manager: z.string().max(120).optional(),
  phone: z.string().max(40).optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});
export const warehouseUpdateSchema = warehouseCreateSchema.partial();

export const supplierCreateSchema = z.object({
  name: z.string().trim().min(2).max(160),
  code: z.string().trim().max(30).optional(),
  company: z.string().max(160).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(40).optional(),
  address: addressSchema,
  taxId: z.string().max(60).optional(),
  paymentTerms: z.coerce.number().int().min(0).max(365).optional(),
  currency: z.string().length(3).optional(),
  openingBalance: z.coerce.number().min(0).optional(),
  status: z.enum(['active', 'inactive', 'blocked']).optional(),
  notes: z.string().max(2000).optional(),
  tags: z.array(z.string().max(30)).max(20).optional(),
  bankDetails: z
    .object({
      bankName: z.string().max(120).optional(),
      accountName: z.string().max(120).optional(),
      accountNumber: z.string().max(60).optional(),
    })
    .optional(),
});
export const supplierUpdateSchema = supplierCreateSchema.partial();

export const productCreateSchema = z.object({
  name: z.string().trim().min(2).max(180),
  sku: z.string().trim().min(1).max(60),
  barcode: z.string().trim().max(80).optional(),
  description: z.string().max(4000).optional(),
  category: optionalObjectId,
  supplier: optionalObjectId,
  warehouse: optionalObjectId,
  type: z.enum(['goods', 'service']).optional(),
  unit: z.string().max(20).optional(),
  costPrice: z.coerce.number().min(0).optional(),
  sellingPrice: z.coerce.number().min(0).optional(),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  stock: z.coerce.number().min(0).optional(),
  reorderPoint: z.coerce.number().min(0).optional(),
  reorderQty: z.coerce.number().min(0).optional(),
  trackInventory: z.boolean().optional(),
  status: z.enum(['active', 'inactive', 'discontinued']).optional(),
  imageUrl: z.string().max(500).optional(),
  tags: z.array(z.string().max(30)).max(20).optional(),
});
export const productUpdateSchema = productCreateSchema.partial();

export const stockAdjustSchema = z.object({
  productId: objectId,
  warehouseId: optionalObjectId,
  quantity: z.coerce.number().min(0),
  note: z.string().max(500).optional(),
});

export const stockTransferSchema = z.object({
  productId: objectId,
  fromWarehouseId: objectId,
  toWarehouseId: objectId,
  quantity: z.coerce.number().positive(),
  note: z.string().max(500).optional(),
});

export const inventoryQuerySchema = paginationSchema.extend({
  category: objectId.optional(),
  warehouse: objectId.optional(),
  status: z.enum(['active', 'inactive', 'discontinued']).optional(),
  lowStock: z.enum(['true', 'false']).optional(),
  type: z.enum(['goods', 'service']).optional(),
});
