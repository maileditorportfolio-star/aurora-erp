'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Ban, Check, Pencil, Plus, Trash2, X } from 'lucide-react';
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
import { PromptDialog } from '@/components/data/prompt-dialog';
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
import { personName, refId, refName } from '@/lib/utils';
import type { PaginationMeta } from '@/lib/types';

interface EmployeeRef {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  employeeId?: string;
  department?: string;
}

interface LeaveRecord {
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

const LEAVE_TYPES = ['annual', 'sick', 'unpaid', 'maternity', 'paternity', 'other'] as const;

const leaveSchema = z.object({
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

type LeaveValues = z.infer<typeof leaveSchema>;

export default function LeavesPage() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [employee, setEmployee] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<LeaveRecord | null>(null);
  const [deleting, setDeleting] = useState<LeaveRecord | null>(null);
  const [approving, setApproving] = useState<LeaveRecord | null>(null);
  const [rejecting, setRejecting] = useState<LeaveRecord | null>(null);
  const [cancelling, setCancelling] = useState<LeaveRecord | null>(null);

  const employees = useResourceOptions<EmployeeRef>('/employees', { limit: 100, sort: 'firstName' });

  const params = {
    page,
    limit,
    employee: employee || undefined,
    status: status || undefined,
    type: type || undefined,
    sort: '-createdAt',
  };

  const list = useQuery({
    queryKey: ['/leaves', 'list', params],
    queryFn: () => api.list<LeaveRecord>(`/leaves${buildQuery(params)}`),
  });

  const pendingCount = useQuery({
    queryKey: ['/leaves', 'count', 'pending'],
    queryFn: () => api.list<LeaveRecord>(`/leaves${buildQuery({ status: 'pending', limit: 1 })}`),
  });
  const approvedCount = useQuery({
    queryKey: ['/leaves', 'count', 'approved'],
    queryFn: () => api.list<LeaveRecord>(`/leaves${buildQuery({ status: 'approved', limit: 1 })}`),
  });
  const rejectedCount = useQuery({
    queryKey: ['/leaves', 'count', 'rejected'],
    queryFn: () => api.list<LeaveRecord>(`/leaves${buildQuery({ status: 'rejected', limit: 1 })}`),
  });

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['/leaves'] }),
      queryClient.invalidateQueries({ queryKey: ['/dashboard'] }),
    ]);
  };

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/leaves/${id}`),
    onSuccess: async () => {
      notifySuccess('Leave request deleted');
      await invalidate();
    },
    onError: (error) => notifyError(error),
  });

  const decide = useMutation({
    mutationFn: ({ id, decision, rejectionReason }: { id: string; decision: 'approved' | 'rejected' | 'cancelled'; rejectionReason?: string }) =>
      api.patch(`/leaves/${id}/decision`, {
        decision,
        ...(rejectionReason ? { rejectionReason } : {}),
      }),
    onSuccess: async (_data, variables) => {
      notifySuccess(
        variables.decision === 'approved'
          ? 'Leave approved'
          : variables.decision === 'rejected'
            ? 'Leave rejected'
            : 'Leave cancelled',
      );
      await invalidate();
    },
    onError: (error) => notifyError(error),
  });

  const rowActions = (leave: LeaveRecord): RowActionItem[] => [
    {
      label: 'Edit request',
      icon: Pencil,
      hidden: leave.status !== 'pending',
      disabled: !can(PERMISSIONS.LEAVES_WRITE),
      onSelect: () => setEditing(leave),
    },
    {
      label: 'Approve',
      icon: Check,
      hidden: leave.status !== 'pending',
      disabled: !can(PERMISSIONS.LEAVES_APPROVE),
      separatorBefore: true,
      onSelect: () => setApproving(leave),
    },
    {
      label: 'Reject',
      icon: X,
      hidden: leave.status !== 'pending',
      disabled: !can(PERMISSIONS.LEAVES_APPROVE),
      destructive: true,
      onSelect: () => setRejecting(leave),
    },
    {
      label: 'Cancel request',
      icon: Ban,
      hidden: leave.status !== 'pending',
      disabled: !can(PERMISSIONS.LEAVES_WRITE),
      onSelect: () => setCancelling(leave),
    },
    {
      label: 'Delete',
      icon: Trash2,
      hidden: leave.status === 'approved',
      disabled: !can(PERMISSIONS.LEAVES_WRITE),
      destructive: true,
      separatorBefore: true,
      onSelect: () => setDeleting(leave),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Leave requests"
        description="Review time-off requests, approve or reject them, and keep a clear absence history."
        actions={
          <Button onClick={() => setCreating(true)} disabled={!can(PERMISSIONS.LEAVES_WRITE)}>
            <Plus />
            New leave request
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <CountCard label="Awaiting decision" value={pendingCount.data?.meta?.total ?? 0} tone="warning" />
        <CountCard label="Approved" value={approvedCount.data?.meta?.total ?? 0} tone="positive" />
        <CountCard label="Rejected" value={rejectedCount.data?.meta?.total ?? 0} tone="negative" />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-border/70 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={employee}
              onChange={(event) => {
                setEmployee(event.target.value);
                setPage(1);
              }}
              className="h-9 w-52"
              aria-label="Filter by employee"
            >
              <option value="">All employees</option>
              {(employees.data?.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {personName(item)}
                </option>
              ))}
            </Select>
            <Select
              value={type}
              onChange={(event) => {
                setType(event.target.value);
                setPage(1);
              }}
              className="h-9 w-40"
              aria-label="Filter by leave type"
            >
              <option value="">All leave types</option>
              {LEAVE_TYPES.map((value) => (
                <option key={value} value={value} className="capitalize">
                  {value}
                </option>
              ))}
            </Select>
            <Select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="h-9 w-40"
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              {['pending', 'approved', 'rejected', 'cancelled'].map((value) => (
                <option key={value} value={value} className="capitalize">
                  {value}
                </option>
              ))}
            </Select>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Only pending requests can be edited, approved or rejected.
          </p>
        </div>

        <DataTable<LeaveRecord>
          columns={[
            {
              key: 'employee',
              header: 'Employee',
              cell: (leave) => (
                <div>
                  <p className="font-medium">{personName(leave.employee)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {typeof leave.employee === 'object' ? leave.employee?.department ?? '' : ''}
                  </p>
                </div>
              ),
            },
            {
              key: 'dates',
              header: 'Dates',
              cell: (leave) => (
                <div>
                  <p>
                    {formatDate(leave.startDate)} → {formatDate(leave.endDate)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{formatNumber(leave.days)} day(s)</p>
                </div>
              ),
            },
            {
              key: 'type',
              header: 'Type',
              cell: (leave) => <StatusBadge status={leave.type} />,
            },
            {
              key: 'reason',
              header: 'Reason',
              cell: (leave) => (
                <div className="max-w-xs">
                  <p className="line-clamp-2 text-xs">{leave.reason}</p>
                  {leave.rejectionReason && (
                    <p className="mt-0.5 text-[11px] text-destructive">Rejected: {leave.rejectionReason}</p>
                  )}
                </div>
              ),
            },
            { key: 'status', header: 'Status', cell: (leave) => <StatusBadge status={leave.status} /> },
            {
              key: 'approvedBy',
              header: 'Decided by',
              cell: (leave) => (
                <span className="text-muted-foreground">
                  {leave.approvedBy ? refName(leave.approvedBy) : '—'}
                </span>
              ),
            },
            {
              key: 'actions',
              header: '',
              className: 'w-12 text-right',
              cell: (leave) => <RowActions items={rowActions(leave)} />,
            },
          ]}
          rows={list.data?.data ?? []}
          loading={list.isLoading}
          emptyTitle="No leave requests"
          emptyDescription="When your team requests time off it will appear here for review."
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

      <LeaveDialog
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
        open={Boolean(approving)}
        onOpenChange={(open) => !open && setApproving(null)}
        title="Approve leave request"
        description={
          approving
            ? `${personName(approving.employee)} will be marked as on leave for ${approving.days} day(s).`
            : undefined
        }
        confirmLabel="Approve leave"
        destructive={false}
        loading={decide.isPending}
        onConfirm={async () => {
          if (!approving) return;
          try {
            await decide.mutateAsync({ id: approving.id, decision: 'approved' });
            setApproving(null);
          } catch {
            // Errors are surfaced by the mutation hook.
          }
        }}
      />

      <PromptDialog
        open={Boolean(rejecting)}
        onOpenChange={(open) => !open && setRejecting(null)}
        title="Reject leave request"
        description={
          rejecting
            ? `Explain why ${personName(rejecting.employee)}'s request is being rejected.`
            : undefined
        }
        label="Reason for rejection"
        placeholder="Coverage, blackout period…"
        confirmLabel="Reject request"
        loading={decide.isPending}
        onConfirm={async (reason) => {
          if (!rejecting) return;
          try {
            await decide.mutateAsync({ id: rejecting.id, decision: 'rejected', rejectionReason: reason });
            setRejecting(null);
          } catch {
            // Errors are surfaced by the mutation hook.
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(cancelling)}
        onOpenChange={(open) => !open && setCancelling(null)}
        title="Cancel leave request"
        description={cancelling ? 'The request will be marked as cancelled.' : undefined}
        confirmLabel="Cancel request"
        destructive={false}
        loading={decide.isPending}
        onConfirm={async () => {
          if (!cancelling) return;
          try {
            await decide.mutateAsync({ id: cancelling.id, decision: 'cancelled' });
            setCancelling(null);
          } catch {
            // Errors are surfaced by the mutation hook.
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete leave request"
        description={
          deleting
            ? `The ${deleting.type} leave request for ${personName(deleting.employee)} will be removed.`
            : undefined
        }
        confirmLabel="Delete request"
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

function CountCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
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
      <p className={`mt-1 text-2xl font-semibold ${valueClass}`}>{formatNumber(value)}</p>
    </Card>
  );
}

function calculateDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const diff = new Date(end).getTime() - new Date(start).getTime();
  if (Number.isNaN(diff) || diff < 0) return 0;
  return Math.floor(diff / 86_400_000) + 1;
}

function LeaveDialog({
  record,
  open,
  onOpenChange,
  employees,
  onSaved,
}: {
  record: LeaveRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: EmployeeRef[];
  onSaved: () => Promise<void>;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = Boolean(record);
  const form = useForm<LeaveValues>({
    resolver: zodResolver(leaveSchema),
    defaultValues: {
      employee: refId(record?.employee) ?? '',
      type: record?.type ?? 'annual',
      startDate: toDateInput(record?.startDate ?? new Date()),
      endDate: toDateInput(record?.endDate ?? new Date()),
      days: record ? String(record.days) : '',
      reason: record?.reason ?? '',
    },
  });

  const startDate = form.watch('startDate');
  const endDate = form.watch('endDate');

  useEffect(() => {
    const days = calculateDays(startDate, endDate);
    if (days > 0) form.setValue('days', String(days));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  useEffect(() => {
    if (open) {
      form.reset({
        employee: refId(record?.employee) ?? '',
        type: record?.type ?? 'annual',
        startDate: toDateInput(record?.startDate ?? new Date()),
        endDate: toDateInput(record?.endDate ?? new Date()),
        days: record ? String(record.days) : '',
        reason: record?.reason ?? '',
      });
      setServerError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, record]);

  const submit = form.handleSubmit(async (values) => {
    setServerError(null);
    const payload = {
      type: values.type,
      startDate: values.startDate,
      endDate: values.endDate,
      days: values.days ? Number(values.days) : undefined,
      reason: values.reason,
    };
    try {
      if (record) {
        await api.patch(`/leaves/${record.id}`, payload);
        notifySuccess('Leave request updated');
      } else {
        await api.post('/leaves', { employee: values.employee, ...payload });
        notifySuccess('Leave request submitted');
      }
      await onSaved();
      onOpenChange(false);
    } catch (error) {
      setServerError(
        error instanceof ApiRequestError ? error.message : 'Unable to save the leave request.',
      );
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit leave request' : 'New leave request'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Changes are only possible while the request is still pending.'
              : 'Submit a time-off request for review. Overlapping active requests are rejected.'}
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
              htmlFor="leave-employee"
              required
              colSpan={2}
              error={form.formState.errors.employee?.message}
            >
              <Select id="leave-employee" disabled={isEdit} {...form.register('employee')}>
                <option value="">Select employee…</option>
                {employees.map((item) => (
                  <option key={item.id} value={item.id}>
                    {personName(item)}
                    {item.employeeId ? ` (${item.employeeId})` : ''}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Leave type" htmlFor="leave-type" required>
              <Select id="leave-type" {...form.register('type')}>
                {LEAVE_TYPES.map((value) => (
                  <option key={value} value={value} className="capitalize">
                    {value}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField
              label="Days"
              htmlFor="leave-days"
              error={form.formState.errors.days?.message}
              hint="Calculated from the date range; adjust if needed."
            >
              <Input id="leave-days" type="number" min={0.5} step="0.5" {...form.register('days')} />
            </FormField>
            <FormField
              label="Start date"
              htmlFor="leave-start"
              required
              error={form.formState.errors.startDate?.message}
            >
              <Input id="leave-start" type="date" {...form.register('startDate')} />
            </FormField>
            <FormField
              label="End date"
              htmlFor="leave-end"
              required
              error={form.formState.errors.endDate?.message}
            >
              <Input id="leave-end" type="date" {...form.register('endDate')} />
            </FormField>
            <FormField
              label="Reason"
              htmlFor="leave-reason"
              required
              colSpan={2}
              error={form.formState.errors.reason?.message}
            >
              <Textarea
                id="leave-reason"
                rows={3}
                placeholder="Family trip, medical appointment…"
                {...form.register('reason')}
              />
            </FormField>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              {isEdit ? 'Save changes' : 'Submit request'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
