'use client';
import { KeyRound } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { formatCurrency, formatNumber } from '@/lib/formatters';
import type { AdminOrganization } from '@/components/admin/OrganizationsTab';
import type { PlatformStats, LicenseStatus } from './admin-types';
export { type PlatformStats, type LicenseStatus };

export function OverviewTab({
  stats,
  license,
  orgs,
}: {
  stats?: PlatformStats;
  license?: LicenseStatus;
  orgs: AdminOrganization[];
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Workspaces" value={stats?.organizations ?? 0} hint={`${stats?.activeOrganizations ?? 0} active`} />
        <Kpi label="Active users" value={stats?.users ?? 0} hint="Across platform" />
        <Kpi
          label="Revenue this month"
          value={formatCurrency(stats?.monthRevenue ?? 0)}
          hint={`${formatNumber(stats?.monthInvoices ?? 0)} invoices`}
        />
        <Kpi
          label="License"
          value={license?.edition ?? '—'}
          hint={license?.valid ? 'Valid' : license?.reason ?? 'Unlicensed'}
          tone={license?.valid ? 'positive' : 'warning'}
        />
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Recent workspaces</h3>
        </div>
        <div className="mt-3 space-y-2">
          {orgs.slice(0, 6).map((org) => (
            <div key={org.id} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{org.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {org.slug} · {org.plan} · {org.memberCount ?? 0} members
                </p>
              </div>
              <StatusBadge status={org.status} />
            </div>
          ))}
          {orgs.length === 0 && (
            <p className="py-6 text-center text-xs text-muted-foreground">No workspaces yet.</p>
          )}
        </div>
      </Card>
    </div>
  );
}

export function LicenseTab({ license, loading }: { license?: LicenseStatus; loading?: boolean }) {
  if (loading) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">Loading license…</p>
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <KeyRound className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold">License status</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {license?.valid ? 'Valid commercial license' : license?.reason ?? 'Unlicensed'}
            </p>
          </div>
          <Badge variant={license?.valid ? 'success' : 'destructive'}>
            {license?.valid ? 'Valid' : 'Invalid'}
          </Badge>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Detail label="Edition" value={license?.edition ?? '—'} />
          <Detail label="Licensee" value={license?.licensee ?? '—'} />
          <Detail label="License ID" value={license?.licenseId ?? '—'} />
          <Detail label="Expires" value={license?.expiresAt ?? 'Never'} />
          <Detail label="Max organizations" value={String(license?.maxOrganizations ?? 'Unlimited')} />
          <Detail label="Max users" value={String(license?.maxUsers ?? 'Unlimited')} />
          <Detail label="Enforced" value={license?.enforced ? 'Yes' : 'No'} />
          <Detail label="Environment" value={license?.environment ?? '—'} />
          <Detail label="App version" value={license?.appVersion ?? '—'} />
        </div>
        {license?.features?.length ? (
          <div className="mt-4">
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Licensed features
            </p>
            <div className="flex flex-wrap gap-1.5">
              {license.features.map((feature) => (
                <Badge key={feature} variant="outline" className="text-[10px]">
                  {feature}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

export function Kpi({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'default' | 'positive' | 'warning';
}) {
  return (
    <Card className="p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold ${
          tone === 'positive'
            ? 'text-emerald-600 dark:text-emerald-400'
            : tone === 'warning'
              ? 'text-amber-600 dark:text-amber-400'
              : ''
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </Card>
  );
}

export function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 break-all text-sm">{value}</p>
    </div>
  );
}
