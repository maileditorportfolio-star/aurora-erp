'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Copy, Pencil, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DataTable } from '@/components/data/data-table';
import { Pagination } from '@/components/data/pagination';
import { SearchInput } from '@/components/data/search-input';
import { FormField } from '@/components/data/form-field';
import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { RowActions, type RowActionItem } from '@/components/data/row-actions';
import { PageHeader } from '@/components/layout/page-header';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDebounce } from '@/hooks/use-debounce';
import { useAuth } from '@/hooks/use-auth';
import { notifyError, notifySuccess } from '@/hooks/use-resource';
import { ApiRequestError, api, buildQuery } from '@/lib/api';
import { formatRelative } from '@/lib/formatters';
import { PERMISSIONS, ROLE_LABELS } from '@/lib/permissions';
import { initials, personName, refName } from '@/lib/utils';
import type { PaginationMeta, RoleKey } from '@/lib/types';

const ASSIGNABLE_ROLES: RoleKey[] = ['org_admin', 'manager', 'employee', 'accountant'];

interface TeamUser {
  id?: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
  status?: string;
  lastLoginAt?: string;
}

interface TeamMember {
  id: string;
  user?: TeamUser | string;
  role: RoleKey;
  title?: string;
  status: 'active' | 'invited' | 'suspended';
  permissions?: { grants?: string[]; revokes?: string[] };
  effectivePermissions?: string[];
  createdAt?: string;
}

interface InviteResult {
  email: string;
  temporaryPassword?: string;
  note: string;
}

const inviteSchema = z.object({
  name: z.string().trim().min(2, 'Enter the person’s name').max(120),
  email: z.string().trim().email('Enter a valid email'),
  role: z.enum(['org_admin', 'manager', 'employee', 'accountant']),
  title: z.string().max(120).optional(),
  password: z
    .string()
    .optional()
    .refine(
      (value) =>
        !value ||
        (value.length >= 8 &&
          /[A-Z]/.test(value) &&
          /[a-z]/.test(value) &&
          /[0-9]/.test(value)),
      'Use 8+ characters with upper, lower and a number',
    ),
});

const editSchema = z.object({
  role: z.enum(['org_admin', 'manager', 'employee', 'accountant']),
  title: z.string().max(120).optional(),
  status: z.enum(['active', 'suspended']),
});

type InviteValues = z.infer<typeof inviteSchema>;
type EditValues = z.infer<typeof editSchema>;

const ROLE_VARIANTS: Record<string, 'default' | 'info' | 'success' | 'warning' | 'outline'> = {
  org_admin: 'default',
  manager: 'info',
  accountant: 'success',
  employee: 'outline',
  super_admin: 'warning',
};

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

function InviteDialog({
  open,
  onOpenChange,
  onInvited,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvited: (result: InviteResult) => Promise<void>;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      name: '',
      email: '',
      role: 'employee',
      title: '',
      password: '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({ name: '', email: '', role: 'employee', title: '', password: '' });
      setServerError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      const response = await api.post<{
        member: TeamMember;
        temporaryPassword?: string;
        note: string;
      }>('/team/invite', {
        name: values.name,
        email: values.email,
        role: values.role,
        title: values.title || undefined,
        password: values.password || undefined,
      });
      notifySuccess('Team member added');
      await onInvited({
        email: values.email,
        temporaryPassword: response.temporaryPassword,
        note: response.note,
      });
      onOpenChange(false);
    } catch (error) {
      setServerError(
        error instanceof ApiRequestError ? error.message : 'Unable to invite this person.',
      );
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Invite team member</DialogTitle>
          <DialogDescription>
            New accounts receive a temporary password. Existing Aurora users can be added to this
            workspace with their current login.
          </DialogDescription>
        </DialogHeader>

        {serverError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-xs font-medium text-destructive">
            {serverError}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Full name" htmlFor="invite-name" required error={form.formState.errors.name?.message}>
              <Input id="invite-name" placeholder="Alex Morgan" {...form.register('name')} />
            </FormField>
            <FormField label="Email" htmlFor="invite-email" required error={form.formState.errors.email?.message}>
              <Input id="invite-email" type="email" placeholder="alex@company.com" {...form.register('email')} />
            </FormField>
            <FormField label="Role" htmlFor="invite-role" required hint="Permissions can be tuned after inviting.">
              <Select id="invite-role" {...form.register('role')}>
                {ASSIGNABLE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Job title" htmlFor="invite-title">
              <Input id="invite-title" placeholder="Operations manager" {...form.register('title')} />
            </FormField>
            <FormField
              label="Temporary password"
              htmlFor="invite-password"
              colSpan={2}
              error={form.formState.errors.password?.message}
              hint="Optional. Leave blank to generate one automatically."
            >
              <Input id="invite-password" type="text" autoComplete="new-password" {...form.register('password')} />
            </FormField>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              <UserPlus />
              Add member
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InviteResultDialog({
  result,
  onOpenChange,
}: {
  result: InviteResult | null;
  onOpenChange: (open: boolean) => void;
}) {
  async function copyPassword() {
    if (!result?.temporaryPassword) return;
    try {
      await navigator.clipboard.writeText(result.temporaryPassword);
      notifySuccess('Password copied');
    } catch {
      notifyError(new Error('Could not copy the password. Select it manually.'));
    }
  }

  return (
    <Dialog open={Boolean(result)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Member added</DialogTitle>
          <DialogDescription>{result?.note}</DialogDescription>
        </DialogHeader>

        {result?.temporaryPassword ? (
          <div className="space-y-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Temporary password
              </p>
              <div className="mt-1 flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
                <code className="flex-1 break-all font-mono text-sm">{result.temporaryPassword}</code>
                <Button variant="outline" size="icon-sm" onClick={() => void copyPassword()} aria-label="Copy password">
                  <Copy />
                </Button>
              </div>
            </div>
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] font-medium text-amber-700 dark:text-amber-400">
              Share this password over a secure channel. The user must change it after signing in.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            The existing account was added to this workspace with its current credentials.
          </p>
        )}

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditMemberDialog({
  member,
  self,
  permissions,
  onOpenChange,
  onSaved,
}: {
  member: TeamMember | null;
  self: boolean;
  permissions: string[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [grants, setGrants] = useState<string[]>([]);
  const [revokes, setRevokes] = useState<string[]>([]);
  const [filter, setFilter] = useState('');
  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      role: (member?.role as EditValues['role']) ?? 'employee',
      title: member?.title ?? '',
      status: member?.status === 'suspended' ? 'suspended' : 'active',
    },
  });

  useEffect(() => {
    if (member) {
      form.reset({
        role: (member.role === 'super_admin' ? 'org_admin' : member.role) as EditValues['role'],
        title: member.title ?? '',
        status: member.status === 'suspended' ? 'suspended' : 'active',
      });
      setGrants(member.permissions?.grants ?? []);
      setRevokes(member.permissions?.revokes ?? []);
      setFilter('');
      setServerError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member]);

  const grouped = useMemo(() => {
    const query = filter.trim().toLowerCase();
    const map = new Map<string, string[]>();
    for (const permission of permissions) {
      if (query && !permission.toLowerCase().includes(query)) continue;
      const [resource] = permission.split(':');
      const list = map.get(resource) ?? [];
      list.push(permission);
      map.set(resource, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [permissions, filter]);

  function setOverride(permission: string, mode: '' | 'grant' | 'revoke') {
    setGrants((current) => {
      const next = current.filter((value) => value !== permission);
      return mode === 'grant' ? [...next, permission] : next;
    });
    setRevokes((current) => {
      const next = current.filter((value) => value !== permission);
      return mode === 'revoke' ? [...next, permission] : next;
    });
  }

  const submit = form.handleSubmit(async (values) => {
    if (!member) return;
    setServerError(null);
    try {
      await api.patch(`/team/${member.id}`, {
        role: values.role,
        title: values.title || undefined,
        status: values.status,
        permissions: { grants, revokes },
      });
      notifySuccess('Team member updated');
      await onSaved();
      onOpenChange(false);
    } catch (error) {
      setServerError(
        error instanceof ApiRequestError ? error.message : 'Unable to update this team member.',
      );
    }
  });

  return (
    <Dialog open={Boolean(member)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle>Edit {refName(member?.user)}</DialogTitle>
          <DialogDescription>
            Change the role, suspend access, or fine-tune individual permissions. Grants and revokes
            override the role defaults.
          </DialogDescription>
        </DialogHeader>

        {serverError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-xs font-medium text-destructive">
            {serverError}
          </div>
        )}

        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Role" htmlFor="edit-role" required hint={self ? 'You cannot change your own role.' : undefined}>
              <Select id="edit-role" disabled={self} {...form.register('role')}>
                {ASSIGNABLE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Job title" htmlFor="edit-title">
              <Input id="edit-title" {...form.register('title')} />
            </FormField>
            <FormField label="Status" htmlFor="edit-status" hint={self ? 'You cannot suspend yourself.' : undefined}>
              <Select id="edit-status" disabled={self} {...form.register('status')}>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </Select>
            </FormField>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">Permission overrides</p>
                <p className="text-[11px] text-muted-foreground">
                  {grants.length} granted · {revokes.length} revoked
                </p>
              </div>
              <Input
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Filter permissions…"
                className="h-8 w-full sm:w-56"
              />
            </div>

            <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border border-border/80 p-2 scrollbar-thin">
              {grouped.length === 0 && (
                <p className="px-2 py-6 text-center text-xs text-muted-foreground">No permissions match.</p>
              )}
              {grouped.map(([resource, list]) => (
                <details key={resource} className="rounded-md border border-border/60" open={Boolean(filter)}>
                  <summary className="cursor-pointer px-2.5 py-1.5 text-xs font-medium capitalize">
                    {resource.replace(/_/g, ' ')}
                    <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">
                      {list.length}
                    </span>
                  </summary>
                  <div className="space-y-1 border-t border-border/60 p-1.5">
                    {list.map((permission) => {
                      const action = permission.split(':')[1] ?? permission;
                      const mode = grants.includes(permission)
                        ? 'grant'
                        : revokes.includes(permission)
                          ? 'revoke'
                          : '';
                      return (
                        <div
                          key={permission}
                          className="flex items-center justify-between gap-2 rounded px-1.5 py-1 text-xs hover:bg-muted/50"
                        >
                          <span className="capitalize text-muted-foreground">{action.replace(/_/g, ' ')}</span>
                          <select
                            value={mode}
                            onChange={(event) =>
                              setOverride(permission, event.target.value as '' | 'grant' | 'revoke')
                            }
                            className="h-7 rounded-md border border-input bg-card px-1.5 text-[11px]"
                            aria-label={`Override ${permission}`}
                          >
                            <option value="">Inherited</option>
                            <option value="grant">Grant</option>
                            <option value="revoke">Revoke</option>
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </details>
              ))}
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
              Permission changes take effect on the member&apos;s next API request.
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
