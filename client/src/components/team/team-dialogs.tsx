'use client';
import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Copy, ShieldCheck, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { FormField } from '@/components/data/form-field';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { notifyError, notifySuccess } from '@/hooks/use-resource';
import { ApiRequestError, api } from '@/lib/api';
import { ROLE_LABELS } from '@/lib/permissions';
import { refName } from '@/lib/utils';
import { ASSIGNABLE_ROLES, editSchema, inviteSchema, type EditValues, type InviteResult, type InviteValues, type TeamMember, type TeamUser } from '@/lib/schemas/team';
export { type TeamMember, type TeamUser, type InviteResult, type InviteValues, type EditValues };

export function InviteDialog({
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

export function InviteResultDialog({
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

export function EditMemberDialog({
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
