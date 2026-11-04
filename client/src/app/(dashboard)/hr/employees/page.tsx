'use client';

import { z } from 'zod';
import { ResourcePage } from '@/components/crud/resource-page';
import { ResourceDialog, type FormFieldConfig } from '@/components/crud/resource-dialog';
import { StatusBadge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/use-auth';
import { useSaveResource } from '@/hooks/use-save-resource';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { PERMISSIONS } from '@/lib/permissions';
import { optionalEmail, optionalNumber, optionalString } from '@/lib/validation';
import type { ResourceFormRendererProps } from '@/components/crud/resource-page';

interface Employee {
  id: string;
  employeeId?: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  department: string;
  designation: string;
  joinDate?: string;
  employmentType?: string;
  status?: string;
  salary?: {
    basic?: number;
    housingAllowance?: number;
    transportAllowance?: number;
    otherAllowances?: number;
    taxRate?: number;
    pensionRate?: number;
    otherDeductions?: number;
  };
  bank?: { bankName?: string; accountName?: string; accountNumber?: string };
  address?: { city?: string; country?: string };
  notes?: string;
}

const schema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(80),
  lastName: z.string().trim().min(1, 'Last name is required').max(80),
  email: optionalEmail,
  phone: optionalString,
  department: z.string().trim().min(1, 'Department is required').max(80),
  designation: z.string().trim().min(1, 'Designation is required').max(120),
  joinDate: z.string().min(1, 'Join date is required'),
  employmentType: z.enum(['full_time', 'part_time', 'contract', 'intern']).optional(),
  status: z.enum(['active', 'on_leave', 'terminated']).optional(),
  salary: z
    .object({
      basic: optionalNumber,
      housingAllowance: optionalNumber,
      transportAllowance: optionalNumber,
      otherAllowances: optionalNumber,
      taxRate: optionalNumber,
      pensionRate: optionalNumber,
      otherDeductions: optionalNumber,
    })
    .optional(),
  bank: z
    .object({ bankName: optionalString, accountName: optionalString, accountNumber: optionalString })
    .optional(),
  address: z.object({ city: optionalString, country: optionalString }).optional(),
  notes: optionalString,
});

const FIELDS: FormFieldConfig[] = [
  { name: 'firstName', label: 'First name', required: true },
  { name: 'lastName', label: 'Last name', required: true },
  { name: 'email', label: 'Work email', type: 'email' },
  { name: 'phone', label: 'Phone', type: 'tel' },
  { name: 'department', label: 'Department', required: true, placeholder: 'Engineering' },
  { name: 'designation', label: 'Designation', required: true, placeholder: 'Senior Engineer' },
  { name: 'joinDate', label: 'Join date', type: 'date', required: true },
  { name: 'employmentType', label: 'Employment type', type: 'select', options: [
    { value: 'full_time', label: 'Full time' },
    { value: 'part_time', label: 'Part time' },
    { value: 'contract', label: 'Contract' },
    { value: 'intern', label: 'Intern' },
  ] },
  { name: 'status', label: 'Status', type: 'select', options: [
    { value: 'active', label: 'Active' },
    { value: 'on_leave', label: 'On leave' },
    { value: 'terminated', label: 'Terminated' },
  ] },
  { name: 'address.city', label: 'City' },
  { name: 'address.country', label: 'Country' },
  { name: 'salary.basic', label: 'Basic salary', type: 'number', step: '0.01', min: 0 },
  { name: 'salary.housingAllowance', label: 'Housing allowance', type: 'number', step: '0.01', min: 0 },
  { name: 'salary.transportAllowance', label: 'Transport allowance', type: 'number', step: '0.01', min: 0 },
  { name: 'salary.otherAllowances', label: 'Other allowances', type: 'number', step: '0.01', min: 0 },
  { name: 'salary.taxRate', label: 'Tax rate (%)', type: 'number', step: '0.01', min: 0, max: 100 },
  { name: 'salary.pensionRate', label: 'Pension rate (%)', type: 'number', step: '0.01', min: 0, max: 100 },
  { name: 'salary.otherDeductions', label: 'Other deductions', type: 'number', step: '0.01', min: 0 },
  { name: 'bank.bankName', label: 'Bank name' },
  { name: 'bank.accountName', label: 'Account name' },
  { name: 'bank.accountNumber', label: 'Account number' },
  { name: 'notes', label: 'Notes', type: 'textarea', colSpan: 2 },
];

export default function EmployeesPage() {
  const { can, activeOrganization } = useAuth();
  const currency = activeOrganization?.settings?.currency || 'USD';

  return (
    <ResourcePage<Employee>
      title="Employees"
      description="The people directory that powers attendance, leave and payroll."
      endpoint="/employees"
      createLabel="New employee"
      searchPlaceholder="Search employees…"
      canCreate={can(PERMISSIONS.EMPLOYEES_WRITE)}
      canEdit={can(PERMISSIONS.EMPLOYEES_WRITE)}
      canDelete={can(PERMISSIONS.EMPLOYEES_DELETE)}
      emptyDescription="Add employees to start tracking attendance, leave and payroll."
      deleteDescription={(employee) => `${employee.firstName} ${employee.lastName} will be removed from the directory.`}
      columns={[
        {
          key: 'name',
          header: 'Employee',
          cell: (employee) => (
            <div>
              <p className="font-medium">{employee.firstName} {employee.lastName}</p>
              <p className="text-[11px] text-muted-foreground">{employee.employeeId || '—'}</p>
            </div>
          ),
        },
        { key: 'department', header: 'Department', cell: (employee) => (
          <div>
            <p>{employee.department}</p>
            <p className="text-[11px] text-muted-foreground">{employee.designation}</p>
          </div>
        ) },
        { key: 'email', header: 'Contact', cell: (employee) => <span className="text-muted-foreground">{employee.email || employee.phone || '—'}</span> },
        { key: 'joined', header: 'Joined', cell: (employee) => formatDate(employee.joinDate) },
        { key: 'salary', header: 'Basic salary', align: 'right', cell: (employee) => formatCurrency(employee.salary?.basic ?? 0, currency) },
        { key: 'status', header: 'Status', cell: (employee) => <StatusBadge status={employee.status} /> },
      ]}
      renderForm={({ record, open, onOpenChange }: ResourceFormRendererProps<Employee>) => (
        <EmployeeDialog record={record} open={open} onOpenChange={onOpenChange} />
      )}
    />
  );
}

function EmployeeDialog({
  record,
  open,
  onOpenChange,
}: {
  record: Employee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { save } = useSaveResource('/employees', record?.id);

  return (
    <ResourceDialog
      open={open}
      onOpenChange={onOpenChange}
      title={record ? 'Edit employee' : 'New employee'}
      description="Salary details drive automatic payroll calculations."
      schema={schema}
      fields={FIELDS}
      record={{
        status: 'active',
        employmentType: 'full_time',
        joinDate: new Date().toISOString().slice(0, 10),
        salary: { taxRate: 0, pensionRate: 0 },
        ...record,
      }}
      submitLabel={record ? 'Save changes' : 'Create employee'}
      wide
      onSubmit={async (values) => {
        await save(values);
      }}
    />
  );
}
