'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { CalendarCheck, Pencil, Plus, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/ui/badge';
import { DataTable } from '@/components/data/data-table';
import { Pagination } from '@/components/data/pagination';
import { FormField } from '@/components/data/form-field';
import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { RowActions, type RowActionItem } from '@/components/data/row-actions';
import { PageHeader } from '@/components/layout/page-header';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/use-auth';
import { notifyError, notifySuccess, useResourceOptions } from '@/hooks/use-resource';
import { ApiRequestError, api, buildQuery } from '@/lib/api';
import { formatDate, formatNumber, toDateInput } from '@/lib/formatters';
import { PERMISSIONS } from '@/lib/permissions';
import { personName, refId } from '@/lib/utils';
import type { PaginationMeta } from '@/lib/types';

interface EmployeeRef {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  employeeId?: string;
  department?: string;
}

interface AttendanceRecord {
  id: string;
  employee?: EmployeeRef | string;
  date: string;
  clockIn?: string;
  clockOut?: string;
  status: 'present' | 'absent' | 'late' | 'half_day' | 'leave' | 'holiday';
  hours: number;
  overtimeHours?: number;
  note?: string;
  createdAt?: string;
}

interface AttendanceSummary {
  period: string;
  statuses: Array<{ _id: string; count: number; hours: number }>;
}

const ATTENDANCE_STATUSES = [
  'present',
  'absent',
  'late',
  'half_day',
  'leave',
  'holiday',
] as const;

const attendanceSchema = z.object({
  employee: z.string().min(1, 'Select an employee'),
  date: z.string().min(1, 'Choose a date'),
  clockIn: z.string().optional(),
  clockOut: z.string().optional(),
  status: z.enum(ATTENDANCE_STATUSES),
  hours: z
    .string()
    .optional()
    .refine((value) => !value || (Number(value) >= 0 && Number(value) <= 24), 'Hours must be 0–24'),
  overtimeHours: z
    .string()
    .optional()
    .refine((value) => !value || (Number(value) >= 0 && Number(value) <= 12), 'Overtime must be 0–12'),
  note: z.string().max(500).optional(),
});

type AttendanceValues = z.infer<typeof attendanceSchema>;

const currentPeriod = () => new Date().toISOString().slice(0, 7);

export default function AttendancePage() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState(currentPeriod());
  const [employee, setEmployee] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AttendanceRecord | null>(null);
  const [deleting, setDeleting] = useState<AttendanceRecord | null>(null);

  const employees = useResourceOptions<EmployeeRef>('/employees', { limit: 100, sort: 'firstName' });

  const params = {
    page,
    limit,
    period: period || undefined,
    employee: employee || undefined,
    status: status || undefined,
    sort: '-date',
  };

  const list = useQuery({
    queryKey: ['/attendance', 'list', params],
    queryFn: () => api.list<AttendanceRecord>(`/attendance${buildQuery(params)}`),
  });

  const summary = useQuery<AttendanceSummary>({
    queryKey: ['/attendance', 'summary', period],
    queryFn: () => api.get<AttendanceSummary>(`/attendance/summary${buildQuery({ period })}`),
    enabled: Boolean(period),
  });

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['/attendance'] }),
      queryClient.invalidateQueries({ queryKey: ['/dashboard'] }),
    ]);
  };

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/attendance/${id}`),
    onSuccess: async () => {
      notifySuccess('Attendance record deleted');
      await invalidate();
    },
    onError: (error) => notifyError(error),
  });

  const summaryMap = new Map((summary.data?.statuses ?? []).map((row) => [row._id, row]));
  const present = summaryMap.get('present')?.count ?? 0;
  const late = summaryMap.get('late')?.count ?? 0;
  const absent = summaryMap.get('absent')?.count ?? 0;
  const leave = summaryMap.get('leave')?.count ?? 0;
  const totalHours = (summary.data?.statuses ?? []).reduce((sum, row) => sum + row.hours, 0);

  const rowActions = (record: AttendanceRecord): RowActionItem[] => [
    {
      label: 'Edit',
      icon: Pencil,
      disabled: !can(PERMISSIONS.ATTENDANCE_WRITE),
      onSelect: () => setEditing(record),
    },
    {
      label: 'Delete',
      icon: Trash2,
      destructive: true,
      separatorBefore: true,
      disabled: !can(PERMISSIONS.ATTENDANCE_WRITE),
      onSelect: () => setDeleting(record),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Attendance"
        description="Daily attendance, working hours and overtime for your team."
        actions={
          <Button onClick={() => setCreating(true)} disabled={!can(PERMISSIONS.ATTENDANCE_WRITE)}>
            <Plus />
            Record attendance
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Present" value={formatNumber(present)} tone="positive" />
        <SummaryCard label="Late" value={formatNumber(late)} tone="warning" />
        <SummaryCard label="Absent" value={formatNumber(absent)} tone="negative" />
        <SummaryCard label="On leave" value={formatNumber(leave)} />
        <SummaryCard label="Hours logged" value={formatNumber(totalHours)} />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border/70 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label htmlFor="attendance-period" className="mb-1 block text-[11px] font-medium text-muted-foreground">
                Period
              </label>
              <Input
                id="attendance-period"
                type="month"
                value={period}
                onChange={(event) => {
                  setPeriod(event.target.value);
                  setPage(1);
                }}
                className="w-40"
              />
            </div>
            <div>
              <label htmlFor="attendance-employee" className="mb-1 block text-[11px] font-medium text-muted-foreground">
                Employee
              </label>
              <Select
                id="attendance-employee"
                value={employee}
                onChange={(event) => {
                  setEmployee(event.target.value);
                  setPage(1);
                }}
                className="w-52"
              >
                <option value="">All employees</option>
                {(employees.data?.data ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {personName(item)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label htmlFor="attendance-status" className="mb-1 block text-[11px] font-medium text-muted-foreground">
                Status
              </label>
              <Select
                id="attendance-status"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
                className="w-40"
              >
                <option value="">All statuses</option>
                {ATTENDANCE_STATUSES.map((value) => (
                  <option key={value} value={value} className="capitalize">
                    {value.replace(/_/g, ' ')}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            <CalendarCheck className="mr-1 inline size-3.5" />
            Hours are calculated from clock in/out when left blank.
          </p>
        </div>

        <DataTable<AttendanceRecord>
          columns={[
            {
              key: 'employee',
              header: 'Employee',
              cell: (record) => (
                <div>
                  <p className="font-medium">{personName(record.employee)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {typeof record.employee === 'object' ? record.employee?.employeeId : ''}
                    {typeof record.employee === 'object' && record.employee?.department
                      ? ` · ${record.employee.department}`
                      : ''}
                  </p>
                </div>
              ),
            },
            {
              key: 'date',
              header: 'Date',
              cell: (record) => <span className="text-muted-foreground">{formatDate(record.date)}</span>,
            },
            {
              key: 'clock',
              header: 'Clock in / out',
              cell: (record) => (
                <span className="text-muted-foreground">
                  {record.clockIn || '—'} → {record.clockOut || '—'}
                </span>
              ),
            },
            {
              key: 'hours',
              header: 'Hours',
              align: 'right',
              cell: (record) => (
                <div>
                  <p className="font-medium">{formatNumber(record.hours)}</p>
                  {record.overtimeHours ? (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400">
                      +{formatNumber(record.overtimeHours)} OT
                    </p>
                  ) : null}
                </div>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              cell: (record) => <StatusBadge status={record.status} />,
            },
            {
              key: 'note',
              header: 'Note',
              cell: (record) => (
                <span className="line-clamp-1 text-xs text-muted-foreground">{record.note || '—'}</span>
              ),
            },
            {
              key: 'actions',
              header: '',
              className: 'w-12 text-right',
              cell: (record) => <RowActions items={rowActions(record)} />,
            },
          ]}
          rows={list.data?.data ?? []}
          loading={list.isLoading}
          emptyTitle="No attendance records"
          emptyDescription="Record attendance for the selected period to build the register."
        />

        <Pagination
          meta={(list.data?.meta as PaginationMeta | null) ?? null}
          page={page}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={(value) => {
            setLimit(value);
            setPage(1);
          }}
        />
      </Card>

      <AttendanceDialog
        key={editing?.id ?? 'new'}
        record={editing}
        open={creating || Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditing(null);
          }
        }}
        employees={employees.data?.data ?? []}
        onSaved={invalidate}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete attendance record"
        description={
          deleting
            ? `Attendance for ${personName(deleting.employee)} on ${formatDate(deleting.date)} will be removed.`
            : undefined
        }
        confirmLabel="Delete record"
        loading={remove.isPending}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await remove.mutateAsync(deleting.id);
            setDeleting(null);
          } catch {
            // Errors are surfaced by the mutation hook.
          }
        }}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'positive' | 'warning' | 'negative';
}) {
  const valueClass =
    tone === 'positive'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'warning'
        ? 'text-amber-600 dark:text-amber-400'
        : tone === 'negative'
          ? 'text-destructive'
          : 'text-foreground';
  return (
    <Card className="p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${valueClass}`}>{value}</p>
    </Card>
  );
}

function AttendanceDialog({
  record,
  open,
  onOpenChange,
  employees,
  onSaved,
}: {
  record: AttendanceRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: EmployeeRef[];
  onSaved: () => Promise<void>;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = Boolean(record);
  const form = useForm<AttendanceValues>({
    resolver: zodResolver(attendanceSchema),
    defaultValues: {
      employee: refId(record?.employee) ?? '',
      date: toDateInput(record?.date ?? new Date()),
      clockIn: record?.clockIn ?? '',
      clockOut: record?.clockOut ?? '',
      status: record?.status ?? 'present',
      hours: record ? String(record.hours ?? '') : '',
      overtimeHours: record?.overtimeHours ? String(record.overtimeHours) : '',
      note: record?.note ?? '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        employee: refId(record?.employee) ?? '',
        date: toDateInput(record?.date ?? new Date()),
        clockIn: record?.clockIn ?? '',
        clockOut: record?.clockOut ?? '',
        status: record?.status ?? 'present',
        hours: record ? String(record.hours ?? '') : '',
        overtimeHours: record?.overtimeHours ? String(record.overtimeHours) : '',
        note: record?.note ?? '',
      });
      setServerError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, record]);

  const submit = form.handleSubmit(async (values) => {
    setServerError(null);
    const payload = {
      date: values.date,
      clockIn: values.clockIn || undefined,
      clockOut: values.clockOut || undefined,
      status: values.status,
      hours: values.hours ? Number(values.hours) : undefined,
      overtimeHours: values.overtimeHours ? Number(values.overtimeHours) : undefined,
      note: values.note || undefined,
    };
    try {
      if (record) {
        await api.patch(`/attendance/${record.id}`, payload);
        notifySuccess('Attendance updated');
      } else {
        await api.post('/attendance', { employee: values.employee, ...payload });
        notifySuccess('Attendance recorded');
      }
      await onSaved();
      onOpenChange(false);
    } catch (error) {
      setServerError(
        error instanceof ApiRequestError ? error.message : 'Unable to save the attendance record.',
      );
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit attendance' : 'Record attendance'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update hours, status or notes for this attendance record.'
              : 'Add a daily attendance entry. Duplicate employee and date records are rejected.'}
          </DialogDescription>
        </DialogHeader>

        {serverError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-xs font-medium text-destructive">
            {serverError}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Employee"
              htmlFor="attendance-form-employee"
              required
              error={form.formState.errors.employee?.message}
              colSpan={2}
            >
              <Select
                id="attendance-form-employee"
                disabled={isEdit}
                {...form.register('employee')}
              >
                <option value="">Select employee…</option>
                {employees.map((item) => (
                  <option key={item.id} value={item.id}>
                    {personName(item)}
                    {item.employeeId ? ` (${item.employeeId})` : ''}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Date" htmlFor="attendance-form-date" required error={form.formState.errors.date?.message}>
              <Input id="attendance-form-date" type="date" {...form.register('date')} />
            </FormField>
            <FormField label="Status" htmlFor="attendance-form-status" required>
              <Select id="attendance-form-status" {...form.register('status')}>
                {ATTENDANCE_STATUSES.map((value) => (
                  <option key={value} value={value} className="capitalize">
                    {value.replace(/_/g, ' ')}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Clock in" htmlFor="attendance-form-in">
              <Input id="attendance-form-in" type="time" {...form.register('clockIn')} />
            </FormField>
            <FormField label="Clock out" htmlFor="attendance-form-out">
              <Input id="attendance-form-out" type="time" {...form.register('clockOut')} />
            </FormField>
            <FormField
              label="Hours"
              htmlFor="attendance-form-hours"
              error={form.formState.errors.hours?.message}
              hint="Leave blank to calculate from clock times."
            >
              <Input id="attendance-form-hours" type="number" min={0} max={24} step="0.25" {...form.register('hours')} />
            </FormField>
            <FormField
              label="Overtime hours"
              htmlFor="attendance-form-overtime"
              error={form.formState.errors.overtimeHours?.message}
            >
              <Input
                id="attendance-form-overtime"
                type="number"
                min={0}
                max={12}
                step="0.25"
                {...form.register('overtimeHours')}
              />
            </FormField>
            <FormField label="Note" htmlFor="attendance-form-note" colSpan={2}>
              <Textarea id="attendance-form-note" rows={2} {...form.register('note')} />
            </FormField>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              {isEdit ? 'Save changes' : 'Record attendance'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
