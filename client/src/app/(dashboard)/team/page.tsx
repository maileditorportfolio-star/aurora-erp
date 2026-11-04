'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2, UserPlus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DataTable } from '@/components/data/data-table';
import { Pagination } from '@/components/data/pagination';
import { SearchInput } from '@/components/data/search-input';
import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { RowActions, type RowActionItem } from '@/components/data/row-actions';
import { PageHeader } from '@/components/layout/page-header';
import { useDebounce } from '@/hooks/use-debounce';
import { useAuth } from '@/hooks/use-auth';
import { notifyError, notifySuccess } from '@/hooks/use-resource';
import { api, buildQuery } from '@/lib/api';
import { formatRelative } from '@/lib/formatters';
import { PERMISSIONS, ROLE_LABELS } from '@/lib/permissions';
import { initials, personName, refName } from '@/lib/utils';
import type { PaginationMeta } from '@/lib/types';
import { ROLE_VARIANTS, type InviteResult, type TeamMember } from '@/lib/schemas/team';
import { EditMemberDialog, InviteDialog, InviteResultDialog } from '@/components/team/team-dialogs';

export default function TeamPage() {
  const { can, user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [removing, setRemoving] = useState<TeamMember | null>(null);
  const debouncedSearch = useDebounce(search, 300);

  const params = {
    page,
    limit,
    search: debouncedSearch || undefined,
    role: role || undefined,
    status: status || undefined,
  };

  const list = useQuery({
    queryKey: ['/team', 'list', params],
    queryFn: () => api.list<TeamMember>(`/team${buildQuery(params)}`),
  });

  const catalog = useQuery<{ permissions: string[] }>({
    queryKey: ['/team', 'permissions'],
    queryFn: () => api.get<{ permissions: string[] }>('/team/permissions'),
    staleTime: 300_000,
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['/team'] });
  };

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/team/${id}`),
    onSuccess: async () => {
      notifySuccess('Team member removed');
      await invalidate();
    },
    onError: (error) => notifyError(error),
  });

  const members = list.data?.data ?? [];
  const activeCount = members.filter((member) => member.status === 'active').length;
  const adminCount = members.filter((member) => member.role === 'org_admin').length;
  const suspendedCount = members.filter((member) => member.status === 'suspended').length;

  const isSelf = (member: TeamMember) => {
    const memberUser = typeof member.user === 'object' ? member.user : null;
    return Boolean(
      user &&
        (memberUser?.id === user.id || memberUser?.email?.toLowerCase() === user.email.toLowerCase()),
    );
  };

  const rowActions = (member: TeamMember): RowActionItem[] => [
    {
      label: 'Edit member',
      icon: Pencil,
      disabled: !can(PERMISSIONS.TEAM_WRITE),
      onSelect: () => setEditing(member),
    },
    {
      label: 'Remove from workspace',
      icon: Trash2,
      destructive: true,
      separatorBefore: true,
      hidden: isSelf(member),
      disabled: !can(PERMISSIONS.TEAM_DELETE),
      onSelect: () => setRemoving(member),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Team & roles"
        description="Control who can access this workspace and exactly what each person is allowed to do."
        actions={
          <Button onClick={() => setInviting(true)} disabled={!can(PERMISSIONS.TEAM_WRITE)}>
            <UserPlus />
            Invite member
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Active members" value={activeCount} hint="On this page" tone="positive" />
        <SummaryCard label="Administrators" value={adminCount} hint="Full workspace access" />
        <SummaryCard label="Suspended" value={suspendedCount} hint="Access paused" tone="warning" />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-border/70 p-4 lg:flex-row lg:items-center lg:justify-between">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Search title…"
            className="w-full lg:max-w-xs"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={role}
              onChange={(event) => {
                setRole(event.target.value);
                setPage(1);
              }}
              className="h-9 w-40"
              aria-label="Filter by role"
            >
              <option value="">All roles</option>
              {Object.entries(ROLE_LABELS)
                .filter(([key]) => key !== 'super_admin')
                .map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
            </Select>
            <Select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="h-9 w-36"
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </Select>
          </div>
        </div>

        <DataTable<TeamMember>
          columns={[
            {
              key: 'user',
              header: 'Member',
              cell: (member) => {
                const memberUser = typeof member.user === 'object' ? member.user : undefined;
                return (
                  <div className="flex items-center gap-3">
                    <Avatar className="size-9">
                      {memberUser?.avatarUrl ? (
                        <AvatarImage src={memberUser.avatarUrl} alt={memberUser.name ?? ''} />
                      ) : null}
                      <AvatarFallback>{initials(memberUser?.name ?? personName(member.user))}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {memberUser?.name ?? refName(member.user)}
                        {isSelf(member) && (
                          <span className="ml-1.5 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            You
                          </span>
                        )}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {memberUser?.email ?? member.title ?? '—'}
                      </p>
                    </div>
                  </div>
                );
              },
            },
            {
              key: 'role',
              header: 'Role',
              cell: (member) => (
                <div>
                  <Badge variant={ROLE_VARIANTS[member.role] ?? 'outline'}>
                    {ROLE_LABELS[member.role] ?? member.role}
                  </Badge>
                  {member.title && (
                    <p className="mt-1 text-[11px] text-muted-foreground">{member.title}</p>
                  )}
                </div>
              ),
            },
            {
              key: 'permissions',
              header: 'Permissions',
              cell: (member) => {
                const count = member.effectivePermissions?.includes('*')
                  ? 'All'
                  : String(member.effectivePermissions?.length ?? 0);
                const overrides =
                  (member.permissions?.grants?.length ?? 0) + (member.permissions?.revokes?.length ?? 0);
                return (
                  <div className="text-xs text-muted-foreground">
                    <p>{count} permissions</p>
                    {overrides > 0 && <p className="text-[11px]">{overrides} override(s)</p>}
                  </div>
                );
              },
            },
            { key: 'status', header: 'Status', cell: (member) => <StatusBadge status={member.status} /> },
            {
              key: 'lastLogin',
              header: 'Last active',
              cell: (member) => (
                <span className="text-[11px] text-muted-foreground">
                  {typeof member.user === 'object' && member.user?.lastLoginAt
                    ? formatRelative(member.user.lastLoginAt)
                    : 'Never'}
                </span>
              ),
            },
            {
              key: 'actions',
              header: '',
              className: 'w-12 text-right',
              cell: (member) => <RowActions items={rowActions(member)} />,
            },
          ]}
          rows={members}
          loading={list.isLoading}
          emptyTitle="No team members found"
          emptyDescription="Invite a colleague to collaborate in this workspace."
        />

        <Pagination
          meta={(list.data?.meta as PaginationMeta | null) ?? null}
          page={page}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={(value) => {
            setLimit(value);
            setPage(1);
          }}
        />
      </Card>

      <InviteDialog
        open={inviting}
        onOpenChange={setInviting}
        onInvited={async (result) => {
          setInviteResult(result);
          await invalidate();
        }}
      />

      <InviteResultDialog result={inviteResult} onOpenChange={(open) => !open && setInviteResult(null)} />

      <EditMemberDialog
        key={editing?.id ?? 'edit'}
        member={editing}
        self={editing ? isSelf(editing) : false}
        permissions={catalog.data?.permissions ?? []}
        onOpenChange={(open) => !open && setEditing(null)}
        onSaved={invalidate}
      />

      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Remove team member"
        description={
          removing
            ? `${refName(removing.user)} will lose access to this workspace. Their account and other workspaces are unaffected.`
            : undefined
        }
        confirmLabel="Remove member"
        loading={remove.isPending}
        onConfirm={async () => {
          if (!removing) return;
          try {
            await remove.mutateAsync(removing.id);
            setRemoving(null);
          } catch {
            // Errors are surfaced by the mutation hook.
          }
        }}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: number;
  hint: string;
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
      <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
    </Card>
  );
}
