'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  FileText,
  KeyRound,
  Plus,
  Search,
  ShieldCheck,
  UserCog,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { DataTable } from '@/components/data/data-table';
import { Pagination } from '@/components/data/pagination';
import { SearchInput } from '@/components/data/search-input';
import { FormField } from '@/components/data/form-field';
import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { PageHeader } from '@/components/layout/page-header';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDebounce } from '@/hooks/use-debounce';
import { useAuth } from '@/hooks/use-auth';
import { notifyError, notifySuccess } from '@/hooks/use-resource';
import { api, buildQuery } from '@/lib/api';
import { formatCurrency, formatDateTime, formatNumber } from '@/lib/formatters';
import { initials, refName } from '@/lib/utils';
import type { PaginationMeta } from '@/lib/types';

interface PlatformStats {
  organizations: number;
  activeOrganizations: number;
  users: number;
  monthRevenue: number;
  monthInvoices: number;
  license: LicenseStatus;
}

interface LicenseStatus {
  valid: boolean;
  enforced: boolean;
  edition: string;
  licensee?: string;
  expiresAt?: string;
  maxOrganizations?: number;
  maxUsers?: number;
  features: string[];
  licenseId?: string;
  reason?: string;
  environment?: string;
  appVersion?: string;
}

interface AdminOrganization {
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

interface AdminUser {
  id: string;
  name: string;
  email: string;
  status?: string;
  isSuperAdmin: boolean;
  lastLoginAt?: string;
  createdAt?: string;
  avatarUrl?: string;
}

interface AuditEntry {
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

import type { CreateOrgValues, EditOrgValues } from '@/lib/schemas/admin';
import { createOrgSchema, editOrgSchema } from '@/lib/schemas/admin';

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

export default function AdminConsolePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState('overview');
  const [orgSearch, setOrgSearch] = useState('');
  const [orgStatus, setOrgStatus] = useState('');
  const [orgPlan, setOrgPlan] = useState('');
  const [orgPage, setOrgPage] = useState(1);
  const [orgLimit, setOrgLimit] = useState(20);
  const [editingOrg, setEditingOrg] = useState<AdminOrganization | null>(null);
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [togglingUser, setTogglingUser] = useState<AdminUser | null>(null);

  const [userSearch, setUserSearch] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [userLimit, setUserLimit] = useState(20);

  const [auditResource, setAuditResource] = useState('');
  const [auditAction, setAuditAction] = useState('');
  const [auditActor, setAuditActor] = useState('');
  const [auditOrg, setAuditOrg] = useState('');
  const [auditFrom, setAuditFrom] = useState('');
  const [auditTo, setAuditTo] = useState('');
  const [auditPage, setAuditPage] = useState(1);
  const [auditLimit, setAuditLimit] = useState(20);
  const [auditDetail, setAuditDetail] = useState<AuditEntry | null>(null);

  const debouncedOrgSearch = useDebounce(orgSearch, 300);
  const debouncedUserSearch = useDebounce(userSearch, 300);

  const stats = useQuery<PlatformStats>({
    queryKey: ['/admin', 'stats'],
    queryFn: () => api.get<PlatformStats>('/admin/stats'),
    enabled: tab === 'overview',
  });

  const license = useQuery<LicenseStatus & { environment?: string; appVersion?: string }>({
    queryKey: ['/admin', 'license'],
    queryFn: () => api.get<LicenseStatus & { environment?: string; appVersion?: string }>('/admin/license'),
    enabled: tab === 'overview' || tab === 'license',
  });

  const orgParams = useMemo(
    () => ({
      page: orgPage,
      limit: orgLimit,
      search: debouncedOrgSearch || undefined,
      status: orgStatus || undefined,
      plan: orgPlan || undefined,
      sort: '-createdAt',
    }),
    [orgPage, orgLimit, debouncedOrgSearch, orgStatus, orgPlan],
  );
  const orgs = useQuery<{ data: AdminOrganization[]; meta: PaginationMeta | null }>({
    queryKey: ['/admin', 'organizations', orgParams],
    queryFn: () => api.list<AdminOrganization>(`/admin/organizations${buildQuery(orgParams)}`),
    enabled: tab === 'organizations' || tab === 'overview',
  });

  const userParams = useMemo(
    () => ({
      page: userPage,
      limit: userLimit,
      search: debouncedUserSearch || undefined,
      sort: '-createdAt',
    }),
    [userPage, userLimit, debouncedUserSearch],
  );
  const users = useQuery<{ data: AdminUser[]; meta: PaginationMeta | null }>({
    queryKey: ['/admin', 'users', userParams],
    queryFn: () => api.list<AdminUser>(`/admin/users${buildQuery(userParams)}`),
    enabled: tab === 'users',
  });

  const auditParams = useMemo(
    () => ({
      page: auditPage,
      limit: auditLimit,
      resource: auditResource || undefined,
      action: auditAction || undefined,
      actor: auditActor || undefined,
      organization: auditOrg || undefined,
      from: auditFrom ? `${auditFrom}T00:00:00.000Z` : undefined,
      to: auditTo ? `${auditTo}T23:59:59.999Z` : undefined,
    }),
    [auditPage, auditLimit, auditResource, auditAction, auditActor, auditOrg, auditFrom, auditTo],
  );
  const audits = useQuery<{ data: AuditEntry[]; meta: PaginationMeta | null }>({
    queryKey: ['/admin', 'audits', auditParams],
    queryFn: () => api.list<AuditEntry>(`/admin/audits${buildQuery(auditParams)}`),
    enabled: tab === 'audit',
  });
  const auditStats = useQuery<Array<{ _id: { resource: string; action: string }; count: number }>>({
    queryKey: ['/admin', 'audits', 'stats', auditOrg],
    queryFn: () =>
      api.get<Array<{ _id: { resource: string; action: string }; count: number }>>(
        `/admin/audits/stats${buildQuery({ organization: auditOrg || undefined })}`,
      ),
    enabled: tab === 'audit',
  });

  const createOrg = useMutation({
    mutationFn: (payload: CreateOrgValues) =>
      api.post('/admin/organizations', {
        name: payload.name,
        slug: payload.slug || undefined,
        ownerEmail: payload.ownerEmail,
        plan: payload.plan,
        status: payload.status,
      }),
    onSuccess: async () => {
      notifySuccess('Workspace created');
      setCreatingOrg(false);
      await queryClient.invalidateQueries({ queryKey: ['/admin', 'organizations'] });
      await queryClient.invalidateQueries({ queryKey: ['/admin', 'stats'] });
    },
    onError: (error) => notifyError(error),
  });

  const editOrg = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: EditOrgValues }) =>
      api.patch(`/admin/organizations/${id}`, {
        name: payload.name || undefined,
        plan: payload.plan,
        status: payload.status,
        appName: payload.appName || undefined,
        brandColor: payload.brandColor || undefined,
      }),
    onSuccess: async () => {
      notifySuccess('Workspace updated');
      setEditingOrg(null);
      await queryClient.invalidateQueries({ queryKey: ['/admin', 'organizations'] });
    },
    onError: (error) => notifyError(error),
  });

  const toggleSuper = useMutation({
    mutationFn: (id: string) => api.patch<{ isSuperAdmin: boolean }>(`/admin/users/${id}/super-admin`, {}),
    onSuccess: async (result: { isSuperAdmin: boolean }) => {
      notifySuccess(result.isSuperAdmin ? 'Granted super admin' : 'Revoked super admin');
      setTogglingUser(null);
      await queryClient.invalidateQueries({ queryKey: ['/admin', 'users'] });
    },
    onError: (error) => notifyError(error),
  });

  if (!user?.isSuperAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md p-8 text-center">
          <ShieldCheck className="mx-auto size-8 text-muted-foreground" />
          <h2 className="mt-3 text-lg font-semibold">Platform access required</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The admin console is only available to platform super administrators.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Admin console"
        description="Manage workspaces, platform users, audit activity and licensing."
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="organizations">Workspaces</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
          <TabsTrigger value="license">License</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab stats={stats.data} license={license.data} orgs={orgs.data?.data ?? []} />
        </TabsContent>

        <TabsContent value="organizations">
          <OrganizationsTab
            orgs={orgs.data?.data ?? []}
            meta={orgs.data?.meta ?? null}
            loading={orgs.isLoading}
            search={orgSearch}
            status={orgStatus}
            plan={orgPlan}
            page={orgPage}
            limit={orgLimit}
            onSearch={(v) => {
              setOrgSearch(v);
              setOrgPage(1);
            }}
            onStatus={(v) => {
              setOrgStatus(v);
              setOrgPage(1);
            }}
            onPlan={(v) => {
              setOrgPlan(v);
              setOrgPage(1);
            }}
            onPage={setOrgPage}
            onLimit={(v) => {
              setOrgLimit(v);
              setOrgPage(1);
            }}
            onCreate={() => setCreatingOrg(true)}
            onEdit={(org) => setEditingOrg(org)}
          />
        </TabsContent>

        <TabsContent value="users">
          <UsersTab
            users={users.data?.data ?? []}
            meta={users.data?.meta ?? null}
            loading={users.isLoading}
            search={userSearch}
            page={userPage}
            limit={userLimit}
            onSearch={(v) => {
              setUserSearch(v);
              setUserPage(1);
            }}
            onPage={setUserPage}
            onLimit={(v) => {
              setUserLimit(v);
              setUserPage(1);
            }}
            onToggle={(u) => setTogglingUser(u)}
          />
        </TabsContent>

        <TabsContent value="audit">
          <AdminAuditTab
            audits={audits.data?.data ?? []}
            meta={audits.data?.meta ?? null}
            loading={audits.isLoading}
            stats={auditStats.data ?? []}
            resource={auditResource}
            action={auditAction}
            actor={auditActor}
            org={auditOrg}
            from={auditFrom}
            to={auditTo}
            page={auditPage}
            limit={auditLimit}
            orgs={orgs.data?.data ?? []}
            users={users.data?.data ?? []}
            onResource={(v) => {
              setAuditResource(v);
              setAuditPage(1);
            }}
            onAction={(v) => {
              setAuditAction(v);
              setAuditPage(1);
            }}
            onActor={(v) => {
              setAuditActor(v);
              setAuditPage(1);
            }}
            onOrg={(v) => {
              setAuditOrg(v);
              setAuditPage(1);
            }}
            onFrom={(v) => {
              setAuditFrom(v);
              setAuditPage(1);
            }}
            onTo={(v) => {
              setAuditTo(v);
              setAuditPage(1);
            }}
            onPage={setAuditPage}
            onLimit={(v) => {
              setAuditLimit(v);
              setAuditPage(1);
            }}
            onDetail={(entry) => setAuditDetail(entry)}
          />
        </TabsContent>

        <TabsContent value="license">
          <LicenseTab license={license.data} loading={license.isLoading} />
        </TabsContent>
      </Tabs>

      <CreateOrgDialog
        open={creatingOrg}
        onOpenChange={setCreatingOrg}
        onSubmit={(values) => createOrg.mutate(values)}
        loading={createOrg.isPending}
      />

      <EditOrgDialog
        org={editingOrg}
        onOpenChange={(open) => !open && setEditingOrg(null)}
        onSubmit={(id, values) => editOrg.mutate({ id, payload: values })}
        loading={editOrg.isPending}
      />

      <ConfirmDialog
        open={Boolean(togglingUser)}
        onOpenChange={(open) => !open && setTogglingUser(null)}
        title={togglingUser?.isSuperAdmin ? 'Revoke super admin' : 'Grant super admin'}
        description={
          togglingUser
            ? `${togglingUser.name} (${togglingUser.email}) will ${
                togglingUser.isSuperAdmin ? 'lose' : 'gain'
              } platform-wide access.`
            : undefined
        }
        confirmLabel={togglingUser?.isSuperAdmin ? 'Revoke' : 'Grant'}
        destructive={Boolean(togglingUser?.isSuperAdmin)}
        loading={toggleSuper.isPending}
        onConfirm={() => {
          if (togglingUser) toggleSuper.mutate(togglingUser.id);
        }}
      />

      <Dialog open={Boolean(auditDetail)} onOpenChange={(open) => !open && setAuditDetail(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto scrollbar-thin">
          <DialogHeader>
            <DialogTitle>Audit event</DialogTitle>
            <DialogDescription>
              {auditDetail ? `${auditDetail.action} · ${auditDetail.resource}` : ''}
            </DialogDescription>
          </DialogHeader>
          {auditDetail && (
            <div className="space-y-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <Detail label="When" value={formatDateTime(auditDetail.createdAt)} />
                <Detail label="Actor" value={auditDetail.actorName ?? refName(auditDetail.actor)} />
                <Detail label="Organization" value={refName(auditDetail.organization)} />
                <Detail label="Action" value={auditDetail.action} />
                <Detail label="Resource" value={auditDetail.resource} />
                <Detail label="Resource ID" value={auditDetail.resourceId ?? '—'} />
                <Detail label="Status" value={String(auditDetail.statusCode ?? '—')} />
                <Detail label="Method" value={auditDetail.method ?? '—'} />
                <Detail label="IP" value={auditDetail.ip ?? '—'} />
                <Detail label="Path" value={auditDetail.path ?? '—'} />
              </div>
              {auditDetail.changes !== undefined && auditDetail.changes !== null && (
                <div>
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Changes
                  </p>
                  <pre className="max-h-72 overflow-auto rounded-lg border border-border/70 bg-muted/40 p-3 text-xs">
                    {JSON.stringify(auditDetail.changes, null, 2)}
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

function OverviewTab({
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

function OrganizationsTab({
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
            <Plus />
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
                  <FileText />
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

function UsersTab({
  users,
  meta,
  loading,
  search,
  page,
  limit,
  onSearch,
  onPage,
  onLimit,
  onToggle,
}: {
  users: AdminUser[];
  meta: PaginationMeta | null;
  loading?: boolean;
  search: string;
  page: number;
  limit: number;
  onSearch: (v: string) => void;
  onPage: (v: number) => void;
  onLimit: (v: number) => void;
  onToggle: (u: AdminUser) => void;
}) {
  return (
    <div className="space-y-4">
      <SearchInput value={search} onChange={onSearch} placeholder="Search users by name or email…" className="w-full sm:max-w-xs" />

      <Card className="overflow-hidden">
        <DataTable<AdminUser>
          columns={[
            {
              key: 'user',
              header: 'User',
              cell: (u) => (
                <div className="flex items-center gap-3">
                  <div className="grid size-9 place-items-center rounded-full bg-muted text-xs font-semibold">
                    {initials(u.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{u.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{u.email}</p>
                  </div>
                </div>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              cell: (u) => <StatusBadge status={u.status} />,
            },
            {
              key: 'platform',
              header: 'Platform role',
              cell: (u) => (
                <Badge variant={u.isSuperAdmin ? 'warning' : 'outline'}>
                  {u.isSuperAdmin ? 'Super admin' : 'User'}
                </Badge>
              ),
            },
            {
              key: 'lastLogin',
              header: 'Last login',
              cell: (u) => <span className="text-[11px] text-muted-foreground">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Never'}</span>,
            },
            {
              key: 'created',
              header: 'Created',
              cell: (u) => <span className="text-[11px] text-muted-foreground">{u.createdAt ? formatDateTime(u.createdAt) : '—'}</span>,
            },
            {
              key: 'actions',
              header: '',
              className: 'w-32 text-right',
              cell: (u) => (
                <Button variant="outline" size="sm" onClick={() => onToggle(u)}>
                  <UserCog />
                  {u.isSuperAdmin ? 'Revoke' : 'Grant'}
                </Button>
              ),
            },
          ]}
          rows={users}
          loading={loading}
          emptyTitle="No users found"
          emptyDescription="Users appear here once they register."
        />
        <Pagination meta={meta} page={page} limit={limit} onPageChange={onPage} onLimitChange={onLimit} />
      </Card>
    </div>
  );
}

function AdminAuditTab({
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
  orgs: AdminOrganization[];
  users: AdminUser[];
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
                  <Search />
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

function LicenseTab({ license, loading }: { license?: LicenseStatus; loading?: boolean }) {
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

function CreateOrgDialog({
  open,
  onOpenChange,
  onSubmit,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: CreateOrgValues) => void;
  loading?: boolean;
}) {
  const form = useForm<CreateOrgValues>({
    resolver: zodResolver(createOrgSchema),
    defaultValues: {
      name: '',
      slug: '',
      ownerEmail: '',
      plan: 'professional',
      status: 'active',
    },
  });

  useEffect(() => {
    if (open) form.reset({ name: '', slug: '', ownerEmail: '', plan: 'professional', status: 'active' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = form.handleSubmit((values) => onSubmit(values));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Create workspace</DialogTitle>
          <DialogDescription>
            Provision a new organization and bootstrap its chart of accounts.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Workspace name" htmlFor="create-name" required error={form.formState.errors.name?.message}>
              <Input id="create-name" {...form.register('name')} />
            </FormField>
            <FormField label="Slug" htmlFor="create-slug" error={form.formState.errors.slug?.message} hint="Optional. Auto-generated from name.">
              <Input id="create-slug" {...form.register('slug')} />
            </FormField>
            <FormField label="Owner email" htmlFor="create-owner" required error={form.formState.errors.ownerEmail?.message} hint="Must be an existing user.">
              <Input id="create-owner" type="email" {...form.register('ownerEmail')} />
            </FormField>
            <FormField label="Plan" htmlFor="create-plan">
              <Select id="create-plan" {...form.register('plan')}>
                <option value="starter">Starter</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
              </Select>
            </FormField>
            <FormField label="Status" htmlFor="create-status">
              <Select id="create-status" {...form.register('status')}>
                <option value="active">Active</option>
                <option value="trial">Trial</option>
                <option value="suspended">Suspended</option>
              </Select>
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              <Plus />
              Create workspace
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditOrgDialog({
  org,
  onOpenChange,
  onSubmit,
  loading,
}: {
  org: AdminOrganization | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (id: string, values: EditOrgValues) => void;
  loading?: boolean;
}) {
  const form = useForm<EditOrgValues>({
    resolver: zodResolver(editOrgSchema),
    defaultValues: {
      name: org?.name ?? '',
      plan: (org?.plan as EditOrgValues['plan']) ?? 'professional',
      status: (org?.status as EditOrgValues['status']) ?? 'active',
      appName: org?.appName ?? '',
      brandColor: org?.brandColor ?? '',
    },
  });

  useEffect(() => {
    if (org) {
      form.reset({
        name: org.name ?? '',
        plan: (org.plan as EditOrgValues['plan']) ?? 'professional',
        status: (org.status as EditOrgValues['status']) ?? 'active',
        appName: org.appName ?? '',
        brandColor: org.brandColor ?? '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org]);

  const submit = form.handleSubmit((values) => {
    if (!org) return;
    onSubmit(org.id, values);
  });

  return (
    <Dialog open={Boolean(org)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit workspace</DialogTitle>
          <DialogDescription>{org?.name}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Name" htmlFor="edit-org-name" error={form.formState.errors.name?.message}>
              <Input id="edit-org-name" {...form.register('name')} />
            </FormField>
            <FormField label="Plan" htmlFor="edit-org-plan">
              <Select id="edit-org-plan" {...form.register('plan')}>
                <option value="starter">Starter</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
              </Select>
            </FormField>
            <FormField label="Status" htmlFor="edit-org-status">
              <Select id="edit-org-status" {...form.register('status')}>
                <option value="active">Active</option>
                <option value="trial">Trial</option>
                <option value="suspended">Suspended</option>
                <option value="cancelled">Cancelled</option>
              </Select>
            </FormField>
            <FormField label="App name" htmlFor="edit-org-appname">
              <Input id="edit-org-appname" {...form.register('appName')} />
            </FormField>
            <FormField label="Brand colour" htmlFor="edit-org-brand" error={form.formState.errors.brandColor?.message}>
              <Input id="edit-org-brand" {...form.register('brandColor')} />
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Kpi({
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 break-all text-sm">{value}</p>
    </div>
  );
}
