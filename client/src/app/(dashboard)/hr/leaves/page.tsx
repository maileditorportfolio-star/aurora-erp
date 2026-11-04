'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/badge';
import { DataTable } from '@/components/data/data-table';
import { Pagination } from '@/components/data/pagination';
import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { PromptDialog } from '@/components/data/prompt-dialog';
import { RowActions, type RowActionItem } from '@/components/data/row-actions';
import { PageHeader } from '@/components/layout/page-header';
import { useAuth } from '@/hooks/use-auth';
import { notifyError, notifySuccess, useResourceOptions } from '@/hooks/use-resource';
import { api, buildQuery } from '@/lib/api';
import { formatDate, formatNumber } from '@/lib/formatters';
import { PERMISSIONS } from '@/lib/permissions';
import { personName, refName } from '@/lib/utils';
import type { PaginationMeta } from '@/lib/types';
import { LEAVE_TYPES, type EmployeeRef, type LeaveRecord } from '@/lib/schemas/leave';
import { CountCard, LeaveDialog } from '@/components/hr/leave-dialog';

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
