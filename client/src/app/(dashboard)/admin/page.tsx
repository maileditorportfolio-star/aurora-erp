'use client';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { PageHeader } from '@/components/layout/page-header';
import { OrganizationsTab } from '@/components/admin/OrganizationsTab';
import type { AdminOrganization } from '@/components/admin/OrganizationsTab';
import { UsersTab } from '@/components/admin/UsersTab';
import type { AdminUser } from '@/components/admin/UsersTab';
import { AdminAuditTab } from '@/components/admin/AuditTab';
import type { AuditEntry } from '@/components/admin/AuditTab';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDebounce } from '@/hooks/use-debounce';
import { useAuth } from '@/hooks/use-auth';
import { notifyError, notifySuccess } from '@/hooks/use-resource';
import { api, buildQuery } from '@/lib/api';
import { formatDateTime } from '@/lib/formatters';
import { refName } from '@/lib/utils';
import type { PaginationMeta } from '@/lib/types';
import type { CreateOrgValues, EditOrgValues } from '@/lib/schemas/admin';
import { LicenseTab, OverviewTab } from '@/components/admin/AdminTabs';
import { CreateOrgDialog, EditOrgDialog } from '@/components/admin/AdminDialogs';
import { Detail } from '@/components/admin/AdminTabs';
import type { LicenseStatus, PlatformStats } from '@/components/admin/admin-types';

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
