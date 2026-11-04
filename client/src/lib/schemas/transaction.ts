import { z } from 'zod';
import type { PaginationMeta } from '@/lib/types';

export interface AccountRef {
  id: string;
  name: string;
  code?: string;
  type?: string;
}

export interface TransactionRecord {
  id: string;
  number: string;
  type: 'income' | 'expense';
  date: string;
  description: string;
  account?: AccountRef | string;
  paymentAccount?: AccountRef | string;
  amount: number;
  taxAmount: number;
  total: number;
  reference?: string;
  status: 'posted' | 'void';
  createdAt?: string;
}

export interface TransactionListMeta extends PaginationMeta {
  summary?: { income: number; expense: number };
}

export const createSchema = z.object({
  type: z.enum(['income', 'expense']),
  date: z.string().min(1, 'Choose a date'),
  description: z.string().trim().min(2, 'Describe the transaction').max(500),
  account: z.string().min(1, 'Select a category account'),
  paymentAccount: z.string().min(1, 'Select the bank or cash account'),
  amount: z
    .string()
    .min(1, 'Enter an amount')
    .refine((value) => Number(value) > 0, 'Amount must be greater than zero'),
  taxAmount: z
    .string()
    .optional()
    .refine((value) => !value || Number(value) >= 0, 'Tax cannot be negative'),
  reference: z.string().max(120).optional(),
});

export const updateSchema = z.object({
  date: z.string().min(1, 'Choose a date'),
  description: z.string().trim().min(2, 'Describe the transaction').max(500),
  reference: z.string().max(120).optional(),
});

export type CreateValues = z.infer<typeof createSchema>;
export type UpdateValues = z.infer<typeof updateSchema>;
