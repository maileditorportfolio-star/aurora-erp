import { z } from 'zod';

export interface EmployeeRef {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  employeeId?: string;
  department?: string;
  designation?: string;
  bank?: { bankName?: string; accountName?: string; accountNumber?: string };
}

export interface SalarySlip {
  id: string;
  employee?: EmployeeRef | string;
  period: string;
  month: number;
  year: number;
  basic: number;
  allowances: { housing: number; transport: number; other: number; total: number };
  deductions: { tax: number; pension: number; other: number; total: number };
  gross: number;
  net: number;
  status: 'draft' | 'approved' | 'paid';
  paidAt?: string;
  paymentMethod?: string;
  notes?: string;
  journalPosted: boolean;
  createdAt?: string;
}

export interface PayrollSummaryRow {
  _id: 'draft' | 'approved' | 'paid';
  count: number;
  gross: number;
  net: number;
}

export const generateSchema = z.object({
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Choose a payroll month'),
});
export type GenerateValues = z.infer<typeof generateSchema>;

export const currentPeriod = () => new Date().toISOString().slice(0, 7);
