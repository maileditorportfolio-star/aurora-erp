'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/data/data-table';
import { Pagination } from '@/components/data/pagination';
import { SearchInput } from '@/components/data/search-input';

import { PageHeader } from '@/components/layout/page-header';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDebounce } from '@/hooks/use-debounce';
import { useAuth } from '@/hooks/use-auth';
import { api, buildQuery } from '@/lib/api';
import { formatDateTime } from '@/lib/formatters';
import { PERMISSIONS } from '@/lib/permissions';
import { refId, refName } from '@/lib/utils';
import type { PaginationMeta } from '@/lib/types';

interface AuditEntry {
  id: string;
  organization?: { id?: string; name?: string; slug?: string } | string;
  actor?: { id?: string; name?: string; email?: string; avatarUrl?: string } | string;
  actorName?: string;
  action: string;
  resource: string;
  resourceId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  ip?: string;
  userAgent?: string;
  changes?: unknown;
  createdAt: string;
}

interface TeamMemberLite {
  id: string;
  user?: { id?: string; name?: string; email?: string } | string;
  role?: string;
}

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

export default function AuditLogPage() {
  const { can } = useAuth();
  const [resource, setResource] = useState('');
  const [action, setAction] = useState('');
  const [actor, setActor] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [detail, setDetail] = useState<AuditEntry | null>(null);
  const debouncedSearch = useDebounce(search, 300);

  const canTeam = can(PERMISSIONS.TEAM_READ);

  const team = useQuery<{ data: TeamMemberLite[] }>({
    queryKey: ['/team', 'options', 'audit'],
    queryFn: () => api.list<TeamMemberLite>(`/team${buildQuery({ limit: 100 })}`),
    enabled: canTeam,
    staleTime: 300_000,
  });

  const params = useMemo(
    () => ({
      page,
      limit,
      resource: resource || undefined,
      action: action || undefined,
      actor: actor || undefined,
      from: from ? `${from}T00:00:00.000Z` : undefined,
      to: to ? `${to}T23:59:59.999Z` : undefined,
      search: debouncedSearch || undefined,
    }),
    [page, limit, resource, action, actor, from, to, debouncedSearch],
  );

  const list = useQuery<{ data: AuditEntry[]; meta: PaginationMeta | null }>({
    queryKey: ['/audit-logs', params],
    queryFn: () => api.list<AuditEntry>(`/audit-logs${buildQuery(params)}`),
  });

  const rows = list.data?.data ?? [];
  const meta = list.data?.meta ?? null;

  const teamMembers = team.data?.data ?? [];

  function actorLabel(entry: AuditEntry): string {
    if (entry.actorName) return entry.actorName;
    if (typeof entry.actor === 'object' && entry.actor) {
      return (entry.actor as { name?: string; email?: string }).name ?? (entry.actor as { email?: string }).email ?? '—';
    }
    return refName(entry.actor);
  }

  const invalidate = async () => {
    await list.refetch();
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit log"
        description="Immutable record of create, update and delete actions across this workspace."
        actions={
          <Button variant="outline" onClick={() => void invalidate()} loading={list.isFetching}>
            <RefreshCw />
            Refresh
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-border/70 p-4 lg:flex-row lg:items-center lg:justify-between">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Search resource or path…"
            className="w-full lg:max-w-xs"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={resource}
              onChange={(event) => {
                setResource(event.target.value);
                setPage(1);
              }}
              className="h-9 w-44"
              aria-label="Filter by resource"
            >
              {RESOURCES.map((value) => (
                <option key={value || 'all'} value={value}>
                  {value ? value.replace(/_/g, ' ') : 'All resources'}
                </option>
              ))}
            </Select>
            <Select
              value={action}
              onChange={(event) => {
                setAction(event.target.value);
                setPage(1);
              }}
              className="h-9 w-36"
              aria-label="Filter by action"
            >
              {ACTIONS.map((value) => (
                <option key={value || 'all'} value={value}>
                  {value ? value : 'All actions'}
                </option>
              ))}
            </Select>
            {canTeam && (
              <Select
                value={actor}
                onChange={(event) => {
                  setActor(event.target.value);
                  setPage(1);
                }}
                className="h-9 w-44"
                aria-label="Filter by actor"
              >
                <option value="">All actors</option>
                {teamMembers.map((member) => {
                  const memberUser = typeof member.user === 'object' ? member.user : undefined;
                  const id = memberUser?.id ?? refId(member.user);
                  const label = memberUser?.name ?? memberUser?.email ?? id ?? '—';
                  return id ? (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ) : null;
                })}
              </Select>
            )}
            <Input
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(1);
              }}
              className="h-9 w-40"
              aria-label="From date"
            />
            <Input
              type="date"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                setPage(1);
              }}
              className="h-9 w-40"
              aria-label="To date"
            />
          </div>
        </div>

        <DataTable<AuditEntry>
          columns={[
            {
              key: 'time',
              header: 'When',
              cell: (entry) => (
                <span className="text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</span>
              ),
            },
            {
              key: 'actor',
              header: 'Actor',
              cell: (entry) => (
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{actorLabel(entry)}</p>
                  {typeof entry.actor === 'object' && entry.actor?.email && (
                    <p className="truncate text-[11px] text-muted-foreground">{entry.actor.email}</p>
                  )}
                </div>
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
                <div className="min-w-0">
                  <p className="text-sm font-medium capitalize">{entry.resource.replace(/_/g, ' ')}</p>
                  {entry.resourceId && (
                    <p className="font-mono text-[10px] text-muted-foreground">{entry.resourceId}</p>
                  )}
                </div>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              cell: (entry) => (
                <Badge
                  variant={
                    (entry.statusCode ?? 200) < 400 ? 'success' : 'destructive'
                  }
                >
                  {entry.statusCode ?? '—'}
                </Badge>
              ),
            },
            {
              key: 'ip',
              header: 'IP',
              cell: (entry) => <span className="text-[11px] text-muted-foreground">{entry.ip ?? '—'}</span>,
            },
            {
              key: 'actions',
              header: '',
              className: 'w-12 text-right',
              cell: (entry) => (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setDetail(entry)}
                  aria-label="View details"
                >
                  <Eye />
                </Button>
              ),
            },
          ]}
          rows={rows}
          loading={list.isLoading}
          emptyTitle="No audit events"
          emptyDescription="Actions performed in this workspace will be recorded here."
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

      <Dialog open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto scrollbar-thin">
          <DialogHeader>
            <DialogTitle>Audit event</DialogTitle>
            <DialogDescription>
              {detail ? `${detail.action} · ${detail.resource}` : ''}
            </DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <Detail label="When" value={formatDateTime(detail.createdAt)} />
                <Detail label="Actor" value={actorLabel(detail)} />
                <Detail label="Action" value={detail.action} />
                <Detail label="Resource" value={detail.resource} />
                <Detail label="Resource ID" value={detail.resourceId ?? '—'} />
                <Detail label="Status" value={String(detail.statusCode ?? '—')} />
                <Detail label="Method" value={detail.method ?? '—'} />
                <Detail label="IP" value={detail.ip ?? '—'} />
                <Detail label="Path" value={detail.path ?? '—'} />
              </div>
              {detail.changes !== undefined && detail.changes !== null && (
                <div>
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Changes
                  </p>
                  <pre className="max-h-72 overflow-auto rounded-lg border border-border/70 bg-muted/40 p-3 text-xs">
                    {JSON.stringify(detail.changes, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 break-all text-sm">{value}</p>
    </div>
  );
}
