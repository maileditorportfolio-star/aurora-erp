'use client';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { FormField } from '@/components/data/form-field';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { notifyError, notifySuccess } from '@/hooks/use-resource';
import { ApiRequestError, api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { personName, refName } from '@/lib/utils';
import { currentPeriod, generateSchema, type GenerateValues, type SalarySlip } from '@/lib/schemas/payroll';
export function SummaryCard({
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

export function formatPeriod(period: string) {
  if (!period || !/^\d{4}-\d{2}$/.test(period)) return period || '—';
  return new Date(`${period}-01T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

export function GenerateDialog({
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

export function SlipDialog({
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

export function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <tr>
      <td className={`px-3 py-2 ${strong ? 'font-medium' : 'text-muted-foreground'}`}>{label}</td>
      <td className={`px-3 py-2 text-right ${strong ? 'font-semibold' : ''}`}>{value}</td>
    </tr>
  );
}

export function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-0.5 font-medium">{value}</div>
    </div>
  );
}
