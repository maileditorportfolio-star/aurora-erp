'use client';

import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { DataTable } from '@/components/data/data-table';
import { Pagination } from '@/components/data/pagination';
import { SearchInput } from '@/components/data/search-input';
import { formatCurrency, formatDateTime, formatNumber } from '@/lib/formatters';
import { refName } from '@/lib/utils';
import type { PaginationMeta } from '@/lib/types';

export interface AdminOrganization {
  id: string;
  name: string;
  slug: string;
  email?: string;
  plan: string;
  status: string;
  logoUrl?: string;
  brandColor?: string;
  appName?: string;
  createdAt?: string;
  trialEndsAt?: string;
  memberCount?: number;
  owner?: { id?: string; name?: string; email?: string } | string;
  invoiceCount?: number;
  revenue?: number;
}

export function OrganizationsTab({
  orgs,
  meta,
  loading,
  search,
  status,
  plan,
  page,
  limit,
  onSearch,
  onStatus,
  onPlan,
  onPage,
  onLimit,
  onCreate,
  onEdit,
}: {
  orgs: AdminOrganization[];
  meta: PaginationMeta | null;
  loading?: boolean;
  search: string;
  status: string;
  plan: string;
  page: number;
  limit: number;
  onSearch: (v: string) => void;
  onStatus: (v: string) => void;
  onPlan: (v: string) => void;
  onPage: (v: number) => void;
  onLimit: (v: number) => void;
  onCreate: () => void;
  onEdit: (org: AdminOrganization) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput value={search} onChange={onSearch} placeholder="Search workspaces…" className="w-full sm:max-w-xs" />
        <div className="flex flex-wrap items-center gap-2">
          <Select value={status} onChange={(e) => onStatus(e.target.value)} className="h-9 w-36" aria-label="Status">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="trial">Trial</option>
            <option value="suspended">Suspended</option>
            <option value="cancelled">Cancelled</option>
          </Select>
          <Select value={plan} onChange={(e) => onPlan(e.target.value)} className="h-9 w-36" aria-label="Plan">
            <option value="">All plans</option>
            <option value="starter">Starter</option>
            <option value="professional">Professional</option>
            <option value="enterprise">Enterprise</option>
          </Select>
          <Button onClick={onCreate}>
            <span className="sr-only">New workspace</span>
            New workspace
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <DataTable<AdminOrganization>
          columns={[
            {
              key: 'name',
              header: 'Workspace',
              cell: (org) => (
                <div className="min-w-0">
                  <p className="truncate font-medium">{org.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{org.slug}</p>
                </div>
              ),
            },
            {
              key: 'owner',
              header: 'Owner',
              cell: (org) => (
                <span className="text-xs text-muted-foreground">
                  {typeof org.owner === 'object' && org.owner ? org.owner.name ?? org.owner.email ?? '—' : refName(org.owner)}
                </span>
              ),
            },
            { key: 'plan', header: 'Plan', cell: (org) => <Badge variant="outline" className="capitalize">{org.plan}</Badge> },
            { key: 'status', header: 'Status', cell: (org) => <StatusBadge status={org.status} /> },
            {
              key: 'members',
              header: 'Members',
              cell: (org) => <span className="text-xs">{formatNumber(org.memberCount ?? 0)}</span>,
              align: 'right',
            },
            {
              key: 'invoices',
              header: 'Invoices',
              cell: (org) => <span className="text-xs">{formatNumber(org.invoiceCount ?? 0)}</span>,
              align: 'right',
            },
            {
              key: 'revenue',
              header: 'Revenue',
              cell: (org) => <span className="text-xs">{formatCurrency(org.revenue ?? 0)}</span>,
              align: 'right',
            },
            {
              key: 'created',
              header: 'Created',
              cell: (org) => <span className="text-[11px] text-muted-foreground">{org.createdAt ? formatDateTime(org.createdAt) : '—'}</span>,
            },
            {
              key: 'actions',
              header: '',
              className: 'w-24 text-right',
              cell: (org) => (
                <Button variant="outline" size="sm" onClick={() => onEdit(org)}>
                  Edit
                </Button>
              ),
            },
          ]}
          rows={orgs}
          loading={loading}
          emptyTitle="No workspaces found"
          emptyDescription="Create a workspace to get started."
        />
        <Pagination meta={meta} page={page} limit={limit} onPageChange={onPage} onLimitChange={onLimit} />
      </Card>
    </div>
  );
}