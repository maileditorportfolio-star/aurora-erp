import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { formatPercent } from '@/lib/formatters';

export function StatCard({
  label,
  value,
  change,
  icon: Icon,
  hint,
  tone = 'primary',
}: {
  label: string;
  value: string;
  change?: number;
  icon: LucideIcon;
  hint?: string;
  tone?: 'primary' | 'success' | 'warning' | 'destructive' | 'sky';
}) {
  const toneClasses: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
    warning: 'bg-amber-500/14 text-amber-600 dark:text-amber-400',
    destructive: 'bg-destructive/10 text-destructive',
    sky: 'bg-sky-500/12 text-sky-600 dark:text-sky-400',
  };
  const positive = (change ?? 0) >= 0;

  return (
    <Card className="relative overflow-hidden p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
        </div>
        <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg', toneClasses[tone])}>
          <Icon className="size-4" />
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11px]">
        {change !== undefined ? (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium',
              positive
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-destructive/10 text-destructive',
            )}
          >
            {positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {formatPercent(change)}
          </span>
        ) : null}
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </div>
    </Card>
  );
}
