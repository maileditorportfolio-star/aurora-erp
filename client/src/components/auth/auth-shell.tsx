import { BarChart3, Boxes, ShieldCheck, Sparkles } from 'lucide-react';
import { BrandMark } from '@/components/layout/brand';

const FEATURES = [
  { icon: Boxes, title: 'Inventory that stays accurate', text: 'Live stock levels, reservations and movements across every warehouse.' },
  { icon: BarChart3, title: 'Finance-ready reporting', text: 'Double-entry journals, P&L, balance sheet and cashflow built in.' },
  { icon: ShieldCheck, title: 'Enterprise access control', text: 'Granular permissions and isolated workspaces for every team.' },
];

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-[oklch(0.22_0.06_273)] p-10 text-white lg:flex lg:flex-col">
        <div className="absolute inset-0 surface-grid opacity-[0.11]" />
        <div className="absolute -right-24 -top-24 size-96 rounded-full bg-primary/35 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 size-96 rounded-full bg-sky-500/20 blur-3xl" />

        <div className="relative flex items-center gap-3">
          <BrandMark className="bg-white/10 text-white" />
          <div>
            <p className="text-sm font-semibold tracking-tight">Aurora ERP</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/55">
              Enterprise resource planning
            </p>
          </div>
        </div>

        <div className="relative mt-auto max-w-lg space-y-5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-medium text-white/80">
            <Sparkles className="size-3" />
            One workspace for every department
          </span>
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            Run sales, inventory, purchasing, finance and people from a single source of truth.
          </h2>
          <p className="text-sm leading-relaxed text-white/60">
            Aurora keeps every team aligned with real-time numbers, controlled workflows and
            auditable records — without the spreadsheet chaos.
          </p>

          <div className="grid gap-3 pt-2">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/10 text-white">
                  <feature.icon className="size-4" />
                </span>
                <div>
                  <p className="text-xs font-semibold text-white/90">{feature.title}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-white/50">{feature.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative mt-10 text-[11px] text-white/35">
          © {new Date().getFullYear()} Aurora ERP. Commercial software — all rights reserved.
        </p>
      </div>

      <div className="flex flex-col justify-center bg-background px-5 py-10 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <BrandMark />
            <span className="text-sm font-semibold">Aurora ERP</span>
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              {eyebrow}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>

          <div className="mt-7">{children}</div>

          {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
