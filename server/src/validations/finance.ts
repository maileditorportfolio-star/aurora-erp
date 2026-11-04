import { z } from 'zod';
import { dateSchema, monthSchema, objectId, optionalObjectId, paginationSchema } from './common';

export const accountCreateSchema = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(2).max(160),
  type: z.enum(['asset', 'liability', 'equity', 'income', 'expense']),
  subtype: z.string().max(60).optional(),
  parent: optionalObjectId,
  isGroup: z.boolean().optional(),
  normalBalance: z.enum(['debit', 'credit']),
  description: z.string().max(1000).optional(),
  isActive: z.boolean().optional(),
});
export const accountUpdateSchema = accountCreateSchema.partial();

export const journalLineSchema = z.object({
  account: objectId,
  description: z.string().max(500).optional(),
  debit: z.coerce.number().min(0).default(0),
  credit: z.coerce.number().min(0).default(0),
});

export const journalCreateSchema = z.object({
  date: dateSchema.optional(),
  description: z.string().trim().min(2).max(500),
  referenceNumber: z.string().max(120).optional(),
  lines: z.array(journalLineSchema).min(2),
});

export const transactionCreateSchema = z.object({
  type: z.enum(['income', 'expense']),
  date: dateSchema.optional(),
  description: z.string().trim().min(2).max(500),
  account: objectId,
  paymentAccount: objectId,
  amount: z.coerce.number().positive(),
  taxAmount: z.coerce.number().min(0).optional(),
  reference: z.string().max(120).optional(),
});

export const financeQuerySchema = paginationSchema.extend({
  type: z.string().optional(),
  account: objectId.optional(),
  status: z.string().optional(),
});

export const reportQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  period: z.enum(['month', 'quarter', 'year']).optional(),
  groupBy: z.enum(['month', 'account', 'category']).optional(),
});

export const payrollGenerateSchema = z.object({
  period: monthSchema,
  employeeIds: z.array(objectId).optional(),
});
