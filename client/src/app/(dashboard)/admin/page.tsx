'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  KeyRound,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { FormField } from '@/components/data/form-field';
import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { PageHeader } from '@/components/layout/page-header';
import { OrganizationsTab } from '@/components/admin/OrganizationsTab';
import type { AdminOrganization } from '@/components/admin/OrganizationsTab';
import { UsersTab } from '@/components/admin/UsersTab';
import type { AdminUser } from '@/components/admin/UsersTab';
import { AdminAuditTab } from '@/components/admin/AuditTab';
import type { AuditEntry } from '@/components/admin/AuditTab';

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
import { refName } from '@/lib/utils';
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




import type { CreateOrgValues, EditOrgValues } from '@/lib/schemas/admin';
import { createOrgSchema, editOrgSchema } from '@/lib/schemas/admin';

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
