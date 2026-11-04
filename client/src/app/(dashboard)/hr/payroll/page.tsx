'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Eye, Trash2, Wallet } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/badge';
import { DataTable } from '@/components/data/data-table';
import { Pagination } from '@/components/data/pagination';
import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { RowActions, type RowActionItem } from '@/components/data/row-actions';
import { PageHeader } from '@/components/layout/page-header';
import { useAuth } from '@/hooks/use-auth';
import { notifyError, notifySuccess, useResourceOptions } from '@/hooks/use-resource';
import { api, buildQuery } from '@/lib/api';
import { formatCurrency, formatNumber } from '@/lib/formatters';
import { PERMISSIONS } from '@/lib/permissions';
import { personName } from '@/lib/utils';
import type { PaginationMeta } from '@/lib/types';
import { currentPeriod, type EmployeeRef, type PayrollSummaryRow, type SalarySlip } from '@/lib/schemas/payroll';
import { GenerateDialog, SlipDialog, SummaryCard, formatPeriod } from '@/components/hr/payroll-dialogs';

export default function PayrollPage() {
  const { can, activeOrganization } = useAuth();
  const currency = activeOrganization?.settings?.currency || 'USD';
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState(currentPeriod());
  const [status, setStatus] = useState('');
  const [employee, setEmployee] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [generating, setGenerating] = useState(false);
  const [viewing, setViewing] = useState<SalarySlip | null>(null);
  const [approving, setApproving] = useState<SalarySlip | null>(null);
  const [paying, setPaying] = useState<SalarySlip | null>(null);
  const [deleting, setDeleting] = useState<SalarySlip | null>(null);

  const employees = useResourceOptions<EmployeeRef>('/employees', { limit: 100, sort: 'firstName' });

  const params = {
    page,
    limit,
    period: period || undefined,
    status: status || undefined,
    employee: employee || undefined,
    sort: '-year,-month',
  };

  const list = useQuery({
    queryKey: ['/payroll', 'list', params],
    queryFn: () => api.list<SalarySlip>(`/payroll${buildQuery(params)}`),
  });

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['/payroll'] }),
      queryClient.invalidateQueries({ queryKey: ['/reports'] }),
      queryClient.invalidateQueries({ queryKey: ['/journal-entries'] }),
      queryClient.invalidateQueries({ queryKey: ['/dashboard'] }),
    ]);
  };

  const changeStatus = useMutation({
    mutationFn: ({ id, target }: { id: string; target: 'approved' | 'paid' }) =>
      api.patch(`/payroll/${id}/status`, {
        status: target,
        ...(target === 'paid' ? { paymentMethod: 'bank' } : {}),
      }),
    onSuccess: async (_data, variables) => {
      notifySuccess(variables.target === 'paid' ? 'Payroll marked as paid' : 'Payroll approved');
      await invalidate();
    },
    onError: (error) => notifyError(error),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/payroll/${id}`),
    onSuccess: async () => {
      notifySuccess('Draft payroll deleted');
      await invalidate();
    },
    onError: (error) => notifyError(error),
  });

  const meta = list.data?.meta as (PaginationMeta & { summary?: PayrollSummaryRow[] }) | null;
  const summaryRows = meta?.summary ?? [];
  const summaryFor = (key: 'draft' | 'approved' | 'paid') =>
    summaryRows.find((row) => row._id === key) ?? { _id: key, count: 0, gross: 0, net: 0 };
  const totalGross = summaryRows.reduce((sum, row) => sum + row.gross, 0);
  const totalNet = summaryRows.reduce((sum, row) => sum + row.net, 0);

  const rowActions = (slip: SalarySlip): RowActionItem[] => [
    { label: 'View payslip', icon: Eye, onSelect: () => setViewing(slip) },
    {
      label: 'Approve payroll',
      icon: CheckCircle2,
      hidden: slip.status !== 'draft',
      separatorBefore: true,
      disabled: !can(PERMISSIONS.PAYROLL_APPROVE),
      onSelect: () => setApproving(slip),
    },
    {
      label: 'Mark as paid',
      icon: Wallet,
      hidden: slip.status !== 'approved',
      separatorBefore: true,
      disabled: !can(PERMISSIONS.PAYROLL_APPROVE),
      onSelect: () => setPaying(slip),
    },
    {
      label: 'Delete draft',
      icon: Trash2,
      hidden: slip.status !== 'draft',
      destructive: true,
      separatorBefore: true,
      disabled: !can(PERMISSIONS.PAYROLL_WRITE),
      onSelect: () => setDeleting(slip),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Payroll"
        description="Generate monthly salary slips from employee salary structures, approve them and post payment to the ledger."
        actions={
          <Button onClick={() => setGenerating(true)} disabled={!can(PERMISSIONS.PAYROLL_WRITE)}>
            <Wallet />
            Generate payroll
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Draft slips" value={formatNumber(summaryFor('draft').count)} hint="Not yet approved" />
        <SummaryCard label="Approved" value={formatNumber(summaryFor('approved').count)} hint="Ready to pay" tone="positive" />
        <SummaryCard label="Paid" value={formatNumber(summaryFor('paid').count)} hint="Posted to ledger" />
        <SummaryCard
          label="Net payroll"
          value={formatCurrency(totalNet, currency)}
          hint={`${formatCurrency(totalGross, currency)} gross`}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-border/70 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label htmlFor="payroll-period" className="mb-1 block text-[11px] font-medium text-muted-foreground">
                Period
              </label>
              <Input
                id="payroll-period"
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
              <label htmlFor="payroll-status" className="mb-1 block text-[11px] font-medium text-muted-foreground">
                Status
              </label>
              <Select
                id="payroll-status"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
                className="w-36"
              >
                <option value="">All statuses</option>
                <option value="draft">Draft</option>
                <option value="approved">Approved</option>
                <option value="paid">Paid</option>
              </Select>
            </div>
            <div>
              <label htmlFor="payroll-employee" className="mb-1 block text-[11px] font-medium text-muted-foreground">
                Employee
              </label>
              <Select
                id="payroll-employee"
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
            <Button
              variant="outline"
              onClick={() => {
                setPeriod('');
                setStatus('');
                setEmployee('');
                setPage(1);
              }}
            >
              All periods
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Payroll moves draft → approved → paid. Payment posts salaries, tax and bank journals.
          </p>
        </div>

        <DataTable<SalarySlip>
          columns={[
            {
              key: 'employee',
              header: 'Employee',
              cell: (slip) => (
                <div>
                  <p className="font-medium">{personName(slip.employee)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {typeof slip.employee === 'object'
                      ? [slip.employee?.employeeId, slip.employee?.designation].filter(Boolean).join(' · ')
                      : ''}
                  </p>
                </div>
              ),
            },
            {
              key: 'period',
              header: 'Period',
              cell: (slip) => <span className="text-muted-foreground">{formatPeriod(slip.period)}</span>,
            },
            {
              key: 'basic',
              header: 'Basic',
              align: 'right',
              cell: (slip) => formatCurrency(slip.basic, currency),
            },
            {
              key: 'allowances',
              header: 'Allowances',
              align: 'right',
              cell: (slip) => formatCurrency(slip.allowances?.total ?? 0, currency),
            },
            {
              key: 'deductions',
              header: 'Deductions',
              align: 'right',
              cell: (slip) => (
                <span className="text-destructive">{formatCurrency(slip.deductions?.total ?? 0, currency)}</span>
              ),
            },
            {
              key: 'net',
              header: 'Net pay',
              align: 'right',
              cell: (slip) => <span className="font-medium">{formatCurrency(slip.net, currency)}</span>,
            },
            { key: 'status', header: 'Status', cell: (slip) => <StatusBadge status={slip.status} /> },
            {
              key: 'actions',
              header: '',
              className: 'w-12 text-right',
              cell: (slip) => <RowActions items={rowActions(slip)} />,
            },
          ]}
          rows={list.data?.data ?? []}
          loading={list.isLoading}
          emptyTitle="No salary slips"
          emptyDescription="Generate payroll for a month to create salary slips for eligible employees."
        />

        <Pagination
          meta={meta}
          page={page}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={(value) => {
            setLimit(value);
            setPage(1);
          }}
        />
      </Card>

      <GenerateDialog
        open={generating}
        onOpenChange={setGenerating}
        onGenerated={async (generatedPeriod) => {
          setPeriod(generatedPeriod);
          await invalidate();
        }}
      />

      <SlipDialog
        slip={viewing}
        currency={currency}
        onOpenChange={(open) => !open && setViewing(null)}
      />

      <ConfirmDialog
        open={Boolean(approving)}
        onOpenChange={(open) => !open && setApproving(null)}
        title="Approve payroll"
        description={
          approving
            ? `${personName(approving.employee)}'s ${formatPeriod(approving.period)} payroll will be approved and locked from editing.`
            : undefined
        }
        confirmLabel="Approve payroll"
        destructive={false}
        loading={changeStatus.isPending}
        onConfirm={async () => {
          if (!approving) return;
          try {
            await changeStatus.mutateAsync({ id: approving.id, target: 'approved' });
            setApproving(null);
          } catch {
            // Errors are surfaced by the mutation hook.
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(paying)}
        onOpenChange={(open) => !open && setPaying(null)}
        title="Mark payroll as paid"
        description={
          paying
            ? `Net pay of ${formatCurrency(paying.net, currency)} will be recorded and the salary journal posted.`
            : undefined
        }
        confirmLabel="Mark as paid"
        destructive={false}
        loading={changeStatus.isPending}
        onConfirm={async () => {
          if (!paying) return;
          try {
            await changeStatus.mutateAsync({ id: paying.id, target: 'paid' });
            setPaying(null);
          } catch {
            // Errors are surfaced by the mutation hook.
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete draft payroll"
        description={
          deleting
            ? `The ${formatPeriod(deleting.period)} draft slip for ${personName(deleting.employee)} will be removed.`
            : undefined
        }
        confirmLabel="Delete draft"
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
