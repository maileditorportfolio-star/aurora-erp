import { z } from 'zod';

export interface EmployeeRef {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  employeeId?: string;
  department?: string;
}

export interface LeaveRecord {
  id: string;
  employee?: EmployeeRef | string;
  type: 'annual' | 'sick' | 'unpaid' | 'maternity' | 'paternity' | 'other';
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approvedBy?: { id?: string; name?: string } | string;
  rejectionReason?: string;
  createdAt?: string;
}

export const LEAVE_TYPES = ['annual', 'sick', 'unpaid', 'maternity', 'paternity', 'other'] as const;

export const leaveSchema = z.object({
  employee: z.string().min(1, 'Select an employee'),
  type: z.enum(LEAVE_TYPES),
  startDate: z.string().min(1, 'Choose a start date'),
  endDate: z.string().min(1, 'Choose an end date'),
  days: z
    .string()
    .optional()
    .refine((value) => !value || Number(value) > 0, 'Days must be greater than zero'),
  reason: z.string().trim().min(3, 'Give a short reason').max(1000),
});

export type LeaveValues = z.infer<typeof leaveSchema>;
