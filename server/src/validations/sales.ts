import { z } from 'zod';
import { addressSchema, dateSchema, lineItemSchema, objectId, optionalObjectId, paginationSchema } from './common';

export const customerCreateSchema = z.object({
  name: z.string().trim().min(2).max(160),
  code: z.string().trim().max(30).optional(),
  company: z.string().max(160).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(40).optional(),
  billingAddress: addressSchema,
  shippingAddress: addressSchema,
  taxId: z.string().max(60).optional(),
  creditLimit: z.coerce.number().min(0).optional(),
  currency: z.string().length(3).optional(),
  status: z.enum(['active', 'inactive', 'blocked']).optional(),
  notes: z.string().max(2000).optional(),
  tags: z.array(z.string().max(30)).max(20).optional(),
});
export const customerUpdateSchema = customerCreateSchema.partial();

const documentItems = z.array(lineItemSchema).min(1, 'Add at least one line item');

export const quotationCreateSchema = z.object({
  customer: objectId,
  date: dateSchema.optional(),
  validUntil: dateSchema,
  items: documentItems,
  status: z.enum(['draft', 'sent', 'accepted', 'rejected', 'expired']).optional(),
  notes: z.string().max(2000).optional(),
  terms: z.string().max(4000).optional(),
});
export const quotationUpdateSchema = quotationCreateSchema.partial();

export const salesOrderCreateSchema = z.object({
  customer: objectId,
  quotation: optionalObjectId,
  date: dateSchema.optional(),
  deliveryDate: dateSchema.optional(),
  warehouse: optionalObjectId,
  items: documentItems,
  status: z
    .enum(['draft', 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'])
    .optional(),
  notes: z.string().max(2000).optional(),
});
export const salesOrderUpdateSchema = salesOrderCreateSchema.partial();

export const invoiceCreateSchema = z.object({
  customer: objectId,
  salesOrder: optionalObjectId,
  quotation: optionalObjectId,
  issueDate: dateSchema.optional(),
  dueDate: dateSchema.optional(),
  warehouse: optionalObjectId,
  items: z.array(lineItemSchema).optional(),
  notes: z.string().max(2000).optional(),
  terms: z.string().max(4000).optional(),
  status: z.enum(['draft', 'sent']).optional(),
});
export const invoiceUpdateSchema = z.object({
  dueDate: dateSchema.optional(),
  notes: z.string().max(2000).optional(),
  terms: z.string().max(4000).optional(),
  status: z.enum(['draft', 'sent']).optional(),
});

export const paymentCreateSchema = z
  .object({
    type: z.enum(['receivable', 'payable']),
    customer: optionalObjectId,
    supplier: optionalObjectId,
    invoice: optionalObjectId,
    bill: optionalObjectId,
    amount: z.coerce.number().positive(),
    method: z.enum(['cash', 'bank', 'card', 'cheque', 'online', 'other']).optional(),
    reference: z.string().max(120).optional(),
    date: dateSchema.optional(),
    notes: z.string().max(1000).optional(),
  })
  .refine((value) => (value.type === 'receivable' ? Boolean(value.invoice || value.customer) : Boolean(value.bill || value.supplier)), {
    message: 'A customer/invoice or supplier/bill is required',
  });

export const salesQuerySchema = paginationSchema.extend({
  customer: objectId.optional(),
  status: z.string().optional(),
  paymentStatus: z.string().optional(),
});
