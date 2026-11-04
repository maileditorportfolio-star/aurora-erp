'use client';
import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { FormField } from '@/components/data/form-field';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { notifySuccess } from '@/hooks/use-resource';
import { ApiRequestError, api } from '@/lib/api';
import { formatNumber, toDateInput } from '@/lib/formatters';
import { personName, refId } from '@/lib/utils';
import { LEAVE_TYPES, leaveSchema, type EmployeeRef, type LeaveRecord, type LeaveValues } from '@/lib/schemas/leave';
export function CountCard({
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

export function calculateDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const diff = new Date(end).getTime() - new Date(start).getTime();
  if (Number.isNaN(diff) || diff < 0) return 0;
  return Math.floor(diff / 86_400_000) + 1;
}

export function LeaveDialog({
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
