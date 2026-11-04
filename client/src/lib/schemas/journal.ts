import { z } from 'zod';

export interface AccountRef {
  id: string;
  name: string;
  code?: string;
  type?: string;
}

export interface JournalLine {
  id?: string;
  account?: AccountRef | string;
  description?: string;
  debit: number;
  credit: number;
}

export interface JournalRecord {
  id: string;
  number: string;
  date: string;
  description: string;
  referenceNumber?: string;
  status: 'draft' | 'posted' | 'void';
  source: string;
  totalDebit: number;
  totalCredit: number;
  lines: JournalLine[];
  createdBy?: { id?: string; name?: string } | string;
  createdAt?: string;
}

export const lineSchema = z
  .object({
    account: z.string().min(1, 'Select an account'),
    description: z.string().max(500).optional(),
    debit: z.string().optional(),
    credit: z.string().optional(),
  })
  .superRefine((line, ctx) => {
    const debit = Number(line.debit || 0);
    const credit = Number(line.credit || 0);
    if (debit < 0) ctx.addIssue({ code: 'custom', path: ['debit'], message: 'Cannot be negative' });
    if (credit < 0) ctx.addIssue({ code: 'custom', path: ['credit'], message: 'Cannot be negative' });
    if (debit === 0 && credit === 0) {
      ctx.addIssue({ code: 'custom', path: ['debit'], message: 'Enter a debit or credit' });
    }
  });

export const journalSchema = z
  .object({
    date: z.string().min(1, 'Choose a date'),
    description: z.string().trim().min(2, 'Describe the entry').max(500),
    referenceNumber: z.string().max(120).optional(),
    lines: z.array(lineSchema).min(2, 'A journal entry needs at least two lines'),
  })
  .superRefine((values, ctx) => {
    const debit = values.lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
    const credit = values.lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
    if (Math.abs(debit - credit) > 0.005) {
      ctx.addIssue({
        code: 'custom',
        path: ['lines'],
        message: `Debits and credits must balance (${debit.toFixed(2)} vs ${credit.toFixed(2)})`,
      });
    }
  });

export type JournalValues = z.infer<typeof journalSchema>;

export const EMPTY_LINE = { account: '', description: '', debit: '', credit: '' };
