import { z } from 'zod';
import { dateSchema, lineItemSchema, objectId, optionalObjectId, paginationSchema } from './common';

export const purchaseOrderCreateSchema = z.object({
  supplier: objectId,
  date: dateSchema.optional(),
  expectedDate: dateSchema.optional(),
  warehouse: optionalObjectId,
  items: z.array(lineItemSchema).min(1, 'Add at least one line item'),
  status: z.enum(['draft', 'pending', 'approved', 'sent', 'cancelled']).optional(),
  notes: z.string().max(2000).optional(),
  terms: z.string().max(4000).optional(),
});
export const purchaseOrderUpdateSchema = purchaseOrderCreateSchema.partial();

const grnItemSchema = z.object({
  product: objectId,
  description: z.string().max(500).optional(),
  orderedQty: z.coerce.number().min(0).default(0),
  receivedQty: z.coerce.number().min(0),
  acceptedQty: z.coerce.number().min(0),
  rejectedQty: z.coerce.number().min(0).default(0),
  unitCost: z.coerce.number().min(0).default(0),
});

export const goodsReceiptCreateSchema = z.object({
  purchaseOrder: objectId,
  warehouse: objectId,
  receivedDate: dateSchema.optional(),
  items: z.array(grnItemSchema).min(1),
  notes: z.string().max(2000).optional(),
  status: z.enum(['draft', 'received']).optional(),
});
export const goodsReceiptUpdateSchema = goodsReceiptCreateSchema
  .omit({ purchaseOrder: true, warehouse: true })
  .partial();

export const billCreateSchema = z.object({
  supplier: objectId,
  purchaseOrder: optionalObjectId,
  goodsReceipt: optionalObjectId,
  issueDate: dateSchema.optional(),
  dueDate: dateSchema,
  items: z.array(lineItemSchema).optional(),
  notes: z.string().max(2000).optional(),
  status: z.enum(['draft', 'open']).optional(),
});
export const billUpdateSchema = z.object({
  dueDate: dateSchema.optional(),
  notes: z.string().max(2000).optional(),
  status: z.enum(['draft', 'open']).optional(),
});

export const purchaseQuerySchema = paginationSchema.extend({
  supplier: objectId.optional(),
  status: z.string().optional(),
});
