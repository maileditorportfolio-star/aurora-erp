'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { CheckCircle2, Eye, Trash2, Wallet } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
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
import { formatCurrency, formatDate, formatNumber } from '@/lib/formatters';
import { PERMISSIONS } from '@/lib/permissions';
import { personName, refName } from '@/lib/utils';
import type { PaginationMeta } from '@/lib/types';

interface EmployeeRef {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  employeeId?: string;
  department?: string;
  designation?: string;
  bank?: { bankName?: string; accountName?: string; accountNumber?: string };
}

interface SalarySlip {
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

interface PayrollSummaryRow {
  _id: 'draft' | 'approved' | 'paid';
  count: number;
  gross: number;
  net: number;
}

const generateSchema = z.object({
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Choose a payroll month'),
});
type GenerateValues = z.infer<typeof generateSchema>;

const currentPeriod = () => new Date().toISOString().slice(0, 7);

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

function SummaryCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'positive';
}) {
  return (
    <Card className="p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone === 'positive' ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </Card>
  );
}

function formatPeriod(period: string) {
  if (!period || !/^\d{4}-\d{2}$/.test(period)) return period || '—';
  return new Date(`${period}-01T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

function GenerateDialog({
  open,
  onOpenChange,
  onGenerated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerated: (period: string) => Promise<void>;
}) {
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);
  const form = useForm<GenerateValues>({
    resolver: zodResolver(generateSchema),
    defaultValues: { period: currentPeriod() },
  });

  const generate = useMutation({
    mutationFn: (values: GenerateValues) =>
      api.post<{ period: string; created: number; skipped: number }>('/payroll/generate', values),
    onError: (error) => notifyError(error),
  });

  const submit = form.handleSubmit(async (values) => {
    setResult(null);
    try {
      const response = await generate.mutateAsync(values);
      setResult({ created: response.created, skipped: response.skipped });
      if (response.created > 0) {
        notifySuccess(`${response.created} salary slip(s) generated`);
        await onGenerated(response.period);
        onOpenChange(false);
      } else {
        notifyError(new Error('No new salary slips were created. Payroll may already exist for this month.'));
      }
    } catch (error) {
      if (!(error instanceof ApiRequestError)) throw error;
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Generate payroll</DialogTitle>
          <DialogDescription>
            Salary slips are created from each active employee&apos;s salary structure. Existing slips for the
            month are skipped.
          </DialogDescription>
        </DialogHeader>

        {result && (
          <div className="rounded-lg border border-border/80 bg-muted/30 px-3 py-2 text-xs">
            Created <span className="font-semibold">{result.created}</span> slip(s), skipped{' '}
            <span className="font-semibold">{result.skipped}</span>.
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <FormField label="Payroll month" htmlFor="generate-period" required error={form.formState.errors.period?.message}>
            <Input id="generate-period" type="month" {...form.register('period')} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={generate.isPending}>
              Generate slips
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SlipDialog({
  slip,
  currency,
  onOpenChange,
}: {
  slip: SalarySlip | null;
  currency: string;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={Boolean(slip)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Payslip · {formatPeriod(slip?.period ?? '')}</DialogTitle>
          <DialogDescription>
            {personName(slip?.employee)} — {formatCurrency(slip?.net ?? 0, currency)} net pay
          </DialogDescription>
        </DialogHeader>

        {slip && (
          <div className="space-y-4">
            <div className="grid gap-3 rounded-lg border border-border/80 bg-muted/30 p-3 text-xs sm:grid-cols-3">
              <Detail label="Status" value={<StatusBadge status={slip.status} />} />
              <Detail label="Employee ID" value={typeof slip.employee === 'object' ? slip.employee?.employeeId ?? '—' : '—'} />
              <Detail
                label="Bank"
                value={typeof slip.employee === 'object' ? refName(slip.employee?.bank?.bankName) : '—'}
              />
            </div>

            <div className="overflow-hidden rounded-lg border border-border/80">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-border/70">
                  <Row label="Basic salary" value={formatCurrency(slip.basic, currency)} />
                  <Row label="Housing allowance" value={formatCurrency(slip.allowances.housing, currency)} />
                  <Row label="Transport allowance" value={formatCurrency(slip.allowances.transport, currency)} />
                  <Row label="Other allowances" value={formatCurrency(slip.allowances.other, currency)} />
                  <Row label="Gross pay" value={formatCurrency(slip.gross, currency)} strong />
                  <Row label="Income tax" value={`− ${formatCurrency(slip.deductions.tax, currency)}`} />
                  <Row label="Pension" value={`− ${formatCurrency(slip.deductions.pension, currency)}`} />
                  <Row label="Other deductions" value={`− ${formatCurrency(slip.deductions.other, currency)}`} />
                  <Row label="Total deductions" value={`− ${formatCurrency(slip.deductions.total, currency)}`} strong />
                  <Row label="Net pay" value={formatCurrency(slip.net, currency)} strong />
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-4 text-[11px] text-muted-foreground">
              <span>Journal posted: {slip.journalPosted ? 'Yes' : 'No'}</span>
              {slip.paidAt && <span>Paid {formatDate(slip.paidAt)}</span>}
              {slip.paymentMethod && <span>Method: {slip.paymentMethod}</span>}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <tr>
      <td className={`px-3 py-2 ${strong ? 'font-medium' : 'text-muted-foreground'}`}>{label}</td>
      <td className={`px-3 py-2 text-right ${strong ? 'font-semibold' : ''}`}>{value}</td>
    </tr>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-0.5 font-medium">{value}</div>
    </div>
  );
}
