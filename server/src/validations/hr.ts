import { z } from 'zod';
import { addressSchema, dateSchema, monthSchema, objectId, paginationSchema } from './common';

export const employeeCreateSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(40).optional(),
  department: z.string().trim().min(1).max(80),
  designation: z.string().trim().min(1).max(120),
  joinDate: dateSchema,
  employmentType: z.enum(['full_time', 'part_time', 'contract', 'intern']).optional(),
  status: z.enum(['active', 'on_leave', 'terminated']).optional(),
  salary: z
    .object({
      basic: z.coerce.number().min(0).optional(),
      housingAllowance: z.coerce.number().min(0).optional(),
      transportAllowance: z.coerce.number().min(0).optional(),
      otherAllowances: z.coerce.number().min(0).optional(),
      taxRate: z.coerce.number().min(0).max(100).optional(),
      pensionRate: z.coerce.number().min(0).max(100).optional(),
      otherDeductions: z.coerce.number().min(0).optional(),
    })
    .optional(),
  bank: z
    .object({
      bankName: z.string().max(120).optional(),
      accountName: z.string().max(120).optional(),
      accountNumber: z.string().max(60).optional(),
    })
    .optional(),
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional().or(z.literal('')),
  address: addressSchema,
  emergencyContact: z
    .object({
      name: z.string().max(120).optional(),
      phone: z.string().max(40).optional(),
      relation: z.string().max(60).optional(),
    })
    .optional(),
  notes: z.string().max(2000).optional(),
});
export const employeeUpdateSchema = employeeCreateSchema.partial();

export const attendanceCreateSchema = z.object({
  employee: objectId,
  date: dateSchema,
  clockIn: z.string().max(10).optional(),
  clockOut: z.string().max(10).optional(),
  status: z.enum(['present', 'absent', 'late', 'half_day', 'leave', 'holiday']).optional(),
  hours: z.coerce.number().min(0).max(24).optional(),
  overtimeHours: z.coerce.number().min(0).max(12).optional(),
  note: z.string().max(500).optional(),
});
export const attendanceUpdateSchema = attendanceCreateSchema.partial().omit({ employee: true });

export const leaveCreateSchema = z.object({
  employee: objectId,
  type: z.enum(['annual', 'sick', 'unpaid', 'maternity', 'paternity', 'other']),
  startDate: dateSchema,
  endDate: dateSchema,
  days: z.coerce.number().positive().max(365),
  reason: z.string().trim().min(3).max(1000),
});
export const leaveUpdateSchema = z.object({
  type: z.enum(['annual', 'sick', 'unpaid', 'maternity', 'paternity', 'other']).optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  days: z.coerce.number().positive().max(365).optional(),
  reason: z.string().trim().min(3).max(1000).optional(),
});

export const leaveDecisionSchema = z.object({
  decision: z.enum(['approved', 'rejected', 'cancelled']),
  rejectionReason: z.string().max(500).optional(),
});

export const payrollQuerySchema = paginationSchema.extend({
  period: monthSchema.optional(),
  status: z.enum(['draft', 'approved', 'paid']).optional(),
  employee: objectId.optional(),
});

export const payrollStatusSchema = z.object({
  status: z.enum(['draft', 'approved', 'paid']),
  paymentMethod: z.string().max(60).optional(),
});

export const hrQuerySchema = paginationSchema.extend({
  department: z.string().optional(),
  status: z.string().optional(),
  employee: objectId.optional(),
  period: monthSchema.optional(),
});
