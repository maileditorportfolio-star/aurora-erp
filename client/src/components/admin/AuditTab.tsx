'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { DataTable } from '@/components/data/data-table';
import { Pagination } from '@/components/data/pagination';
import { formatDateTime } from '@/lib/formatters';
import { refName } from '@/lib/utils';
import type { PaginationMeta } from '@/lib/types';

export interface AuditEntry {
  id: string;
  organization?: { id?: string; name?: string; slug?: string } | string;
  actor?: { id?: string; name?: string; email?: string } | string;
  actorName?: string;
  action: string;
  resource: string;
  resourceId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  ip?: string;
  createdAt: string;
  changes?: unknown;
}

export interface AdminOrganizationLite {
  id: string;
  name: string;
}

export interface AdminUserLite {
  id: string;
  name: string;
}

export function AdminAuditTab({
  audits,
  meta,
  loading,
  stats,
  resource,
  action,
  actor,
  org,
  from,
  to,
  page,
  limit,
  orgs,
  users,
  onResource,
  onAction,
  onActor,
  onOrg,
  onFrom,
  onTo,
  onPage,
  onLimit,
  onDetail,
}: {
  audits: AuditEntry[];
  meta: PaginationMeta | null;
  loading?: boolean;
  stats: { _id: { resource: string; action: string }; count: number }[];
  resource: string;
  action: string;
  actor: string;
  org: string;
  from: string;
  to: string;
  page: number;
  limit: number;
  orgs: AdminOrganizationLite[];
  users: AdminUserLite[];
  onResource: (v: string) => void;
  onAction: (v: string) => void;
  onActor: (v: string) => void;
  onOrg: (v: string) => void;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
  onPage: (v: number) => void;
  onLimit: (v: number) => void;
  onDetail: (entry: AuditEntry) => void;
}) {
  const RESOURCES = [
    '',
    'customers',
    'products',
    'categories',
    'warehouses',
    'suppliers',
    'employees',
    'invoices',
    'quotations',
    'sales_orders',
    'payments',
    'purchase_orders',
    'goods_receipts',
    'bills',
    'accounts',
    'transactions',
    'journal',
    'payroll',
    'leaves',
    'attendance',
    'notifications',
    'team',
    'organization',
    'users',
    'organizations',
    'admin',
  ];
  const ACTIONS = ['', 'create', 'update', 'delete'];

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-border/70 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={resource} onChange={(e) => onResource(e.target.value)} className="h-9 w-40" aria-label="Resource">
              {RESOURCES.map((value) => (
                <option key={value || 'all'} value={value}>
                  {value ? value.replace(/_/g, ' ') : 'All resources'}
                </option>
              ))}
            </Select>
            <Select value={action} onChange={(e) => onAction(e.target.value)} className="h-9 w-32" aria-label="Action">
              {ACTIONS.map((value) => (
                <option key={value || 'all'} value={value}>
                  {value || 'All actions'}
                </option>
              ))}
            </Select>
            <Select value={org} onChange={(e) => onOrg(e.target.value)} className="h-9 w-44" aria-label="Organization">
              <option value="">All workspaces</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
            <Select value={actor} onChange={(e) => onActor(e.target.value)} className="h-9 w-44" aria-label="Actor">
              <option value="">All actors</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
            <Input type="date" value={from} onChange={(e) => onFrom(e.target.value)} className="h-9 w-36" aria-label="From" />
            <Input type="date" value={to} onChange={(e) => onTo(e.target.value)} className="h-9 w-36" aria-label="To" />
          </div>
        </div>

        {stats.length > 0 && (
          <div className="flex flex-wrap gap-2 border-b border-border/70 px-4 py-3">
            {stats.slice(0, 12).map((row, index) => (
              <Badge key={index} variant="outline" className="text-[10px]">
                {row._id.resource} · {row._id.action}: {row.count}
              </Badge>
            ))}
          </div>
        )}

        <DataTable<AuditEntry>
          columns={[
            {
              key: 'time',
              header: 'When',
              cell: (entry) => <span className="text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</span>,
            },
            {
              key: 'org',
              header: 'Workspace',
              cell: (entry) => <span className="text-xs">{refName(entry.organization)}</span>,
            },
            {
              key: 'actor',
              header: 'Actor',
              cell: (entry) => (
                <span className="text-xs">{entry.actorName ?? refName(entry.actor)}</span>
              ),
            },
            {
              key: 'action',
              header: 'Action',
              cell: (entry) => <Badge variant="outline" className="capitalize">{entry.action}</Badge>,
            },
            {
              key: 'resource',
              header: 'Resource',
              cell: (entry) => (
                <span className="text-xs capitalize">{entry.resource.replace(/_/g, ' ')}</span>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              cell: (entry) => (
                <Badge variant={(entry.statusCode ?? 200) < 400 ? 'success' : 'destructive'}>
                  {entry.statusCode ?? '—'}
                </Badge>
              ),
            },
            {
              key: 'actions',
              header: '',
              className: 'w-12 text-right',
              cell: (entry) => (
                <Button variant="ghost" size="icon-sm" onClick={() => onDetail(entry)} aria-label="View">
                  <span className="sr-only">View</span>
                  View
                </Button>
              ),
            },
          ]}
          rows={audits}
          loading={loading}
          emptyTitle="No audit events"
          emptyDescription="Platform activity will appear here."
        />

        <Pagination meta={meta} page={page} limit={limit} onPageChange={onPage} onLimitChange={onLimit} />
      </Card>
    </div>
  );
}