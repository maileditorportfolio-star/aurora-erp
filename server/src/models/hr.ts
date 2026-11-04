import mongoose, { Schema, type HydratedDocument, type Types } from 'mongoose';
import { applyTenantSoftDelete, moneyField, schemaOptions, type SoftDeleteFields } from './helpers';
import { addressSchema } from './inventory';

/* ──────────────────────────────── Employee ──────────────────────────────── */

export interface ISalaryStructure {
  basic: number;
  housingAllowance: number;
  transportAllowance: number;
  otherAllowances: number;
  taxRate: number;
  pensionRate: number;
  otherDeductions: number;
}

export interface IEmployee extends SoftDeleteFields {
  organization: Types.ObjectId;
  employeeId: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  email?: string;
  phone?: string;
  department: string;
  designation: string;
  joinDate: Date;
  employmentType: 'full_time' | 'part_time' | 'contract' | 'intern';
  status: 'active' | 'on_leave' | 'terminated';
  salary: ISalaryStructure;
  bank?: {
    bankName?: string;
    accountName?: string;
    accountNumber?: string;
  };
  userId?: Types.ObjectId | null;
  address?: Record<string, string | undefined>;
  emergencyContact?: {
    name?: string;
    phone?: string;
    relation?: string;
  };
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const salaryStructureSchema = new Schema<ISalaryStructure>(
  {
    basic: moneyField(),
    housingAllowance: moneyField(),
    transportAllowance: moneyField(),
    otherAllowances: moneyField(),
    taxRate: { type: Number, default: 0, min: 0, max: 100 },
    pensionRate: { type: Number, default: 0, min: 0, max: 100 },
    otherDeductions: moneyField(),
  },
  { _id: false },
);

const employeeSchema = new Schema<IEmployee>(
  {
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employeeId: { type: String, required: true, trim: true, uppercase: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phone: String,
    department: { type: String, required: true, trim: true },
    designation: { type: String, required: true, trim: true },
    joinDate: { type: Date, required: true },
    employmentType: {
      type: String,
      enum: ['full_time', 'part_time', 'contract', 'intern'],
      default: 'full_time',
    },
    status: {
      type: String,
      enum: ['active', 'on_leave', 'terminated'],
      default: 'active',
      index: true,
    },
    salary: { type: salaryStructureSchema, default: () => ({}) },
    bank: {
      bankName: String,
      accountName: String,
      accountNumber: String,
    },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    address: addressSchema,
    emergencyContact: {
      name: String,
      phone: String,
      relation: String,
    },
    notes: String,
  },
  schemaOptions,
);

employeeSchema.index({ organization: 1, employeeId: 1 }, { unique: true });
employeeSchema.index({ organization: 1, email: 1 });
employeeSchema.index({ organization: 1, department: 1, status: 1 });
employeeSchema.virtual('fullName').get(function (this: IEmployee) {
  return `${this.firstName} ${this.lastName}`.trim();
});
applyTenantSoftDelete(employeeSchema);

export const Employee = mongoose.model<IEmployee>('Employee', employeeSchema);
export type EmployeeDocument = HydratedDocument<IEmployee>;

/* ──────────────────────────────── Attendance ────────────────────────────── */

export interface IAttendance extends SoftDeleteFields {
  organization: Types.ObjectId;
  employee: Types.ObjectId;
  date: Date;
  clockIn?: string;
  clockOut?: string;
  status: 'present' | 'absent' | 'late' | 'half_day' | 'leave' | 'holiday';
  hours: number;
  overtimeHours: number;
  note?: string;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const attendanceSchema = new Schema<IAttendance>(
  {
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    date: { type: Date, required: true },
    clockIn: String,
    clockOut: String,
    status: {
      type: String,
      enum: ['present', 'absent', 'late', 'half_day', 'leave', 'holiday'],
      default: 'present',
    },
    hours: { type: Number, default: 0, min: 0 },
    overtimeHours: { type: Number, default: 0, min: 0 },
    note: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  schemaOptions,
);

attendanceSchema.index({ organization: 1, employee: 1, date: 1 }, { unique: true });
attendanceSchema.index({ organization: 1, date: -1 });
applyTenantSoftDelete(attendanceSchema);

export const Attendance = mongoose.model<IAttendance>('Attendance', attendanceSchema);
export type AttendanceDocument = HydratedDocument<IAttendance>;

/* ─────────────────────────────── LeaveRequest ───────────────────────────── */

export interface ILeaveRequest extends SoftDeleteFields {
  organization: Types.ObjectId;
  employee: Types.ObjectId;
  type: 'annual' | 'sick' | 'unpaid' | 'maternity' | 'paternity' | 'other';
  startDate: Date;
  endDate: Date;
  days: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const leaveRequestSchema = new Schema<ILeaveRequest>(
  {
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    type: {
      type: String,
      enum: ['annual', 'sick', 'unpaid', 'maternity', 'paternity', 'other'],
      default: 'annual',
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    days: { type: Number, required: true, min: 0.5 },
    reason: { type: String, required: true, maxlength: 1000 },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled'],
      default: 'pending',
      index: true,
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    rejectionReason: String,
  },
  schemaOptions,
);

leaveRequestSchema.index({ organization: 1, employee: 1, startDate: -1 });
applyTenantSoftDelete(leaveRequestSchema);

export const LeaveRequest = mongoose.model<ILeaveRequest>('LeaveRequest', leaveRequestSchema);
export type LeaveRequestDocument = HydratedDocument<ILeaveRequest>;

/* ──────────────────────────────── SalarySlip ────────────────────────────── */

export interface ISalarySlip extends SoftDeleteFields {
  organization: Types.ObjectId;
  employee: Types.ObjectId;
  period: string;
  month: number;
  year: number;
  basic: number;
  allowances: {
    housing: number;
    transport: number;
    other: number;
    total: number;
  };
  deductions: {
    tax: number;
    pension: number;
    other: number;
    total: number;
  };
  gross: number;
  net: number;
  status: 'draft' | 'approved' | 'paid';
  paidAt?: Date;
  paymentMethod?: string;
  notes?: string;
  generatedBy?: Types.ObjectId;
  journalPosted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const salarySlipSchema = new Schema<ISalarySlip>(
  {
    organization: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    period: { type: String, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true, min: 2000 },
    basic: moneyField(),
    allowances: {
      housing: moneyField(),
      transport: moneyField(),
      other: moneyField(),
      total: moneyField(),
    },
    deductions: {
      tax: moneyField(),
      pension: moneyField(),
      other: moneyField(),
      total: moneyField(),
    },
    gross: moneyField(),
    net: moneyField(),
    status: { type: String, enum: ['draft', 'approved', 'paid'], default: 'draft', index: true },
    paidAt: Date,
    paymentMethod: String,
    notes: String,
    generatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    journalPosted: { type: Boolean, default: false },
  },
  schemaOptions,
);

salarySlipSchema.index({ organization: 1, employee: 1, period: 1 }, { unique: true });
salarySlipSchema.index({ organization: 1, period: 1, status: 1 });
applyTenantSoftDelete(salarySlipSchema);

export const SalarySlip = mongoose.model<ISalarySlip>('SalarySlip', salarySlipSchema);
export type SalarySlipDocument = HydratedDocument<ISalarySlip>;
