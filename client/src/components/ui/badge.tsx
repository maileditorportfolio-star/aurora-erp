import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-5 whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary/10 text-primary',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-border text-muted-foreground',
        success: 'border-transparent bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
        warning: 'border-transparent bg-amber-500/14 text-amber-700 dark:text-amber-400',
        destructive: 'border-transparent bg-destructive/12 text-destructive',
        info: 'border-transparent bg-sky-500/12 text-sky-600 dark:text-sky-400',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

const STATUS_VARIANTS: Record<string, BadgeProps['variant']> = {
  active: 'success',
  paid: 'success',
  approved: 'success',
  received: 'success',
  present: 'success',
  delivered: 'success',
  completed: 'success',
  accepted: 'success',
  posted: 'success',
  open: 'info',
  sent: 'info',
  confirmed: 'info',
  processing: 'info',
  partial: 'warning',
  pending: 'warning',
  draft: 'outline',
  trial: 'warning',
  on_leave: 'warning',
  invited: 'info',
  overdue: 'destructive',
  void: 'destructive',
  cancelled: 'destructive',
  rejected: 'destructive',
  suspended: 'destructive',
  terminated: 'destructive',
  blocked: 'destructive',
  absent: 'destructive',
  inactive: 'outline',
  discontinued: 'destructive',
  converted: 'success',
  expired: 'outline',
};

export function StatusBadge({ status, className }: { status?: string; className?: string }) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  const label = status.replace(/_/g, ' ');
  return (
    <Badge variant={STATUS_VARIANTS[status] ?? 'outline'} className={cn('capitalize', className)}>
      {label}
    </Badge>
  );
}

export { Badge, badgeVariants };
