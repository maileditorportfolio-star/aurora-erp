'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { KeyRound, LogOut, Save, ShieldCheck, UserRound } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { FormField } from '@/components/data/form-field';
import { PageHeader } from '@/components/layout/page-header';
import { useAuth } from '@/hooks/use-auth';
import { notifyError, notifySuccess } from '@/hooks/use-resource';
import { ApiRequestError, api, setAccessToken } from '@/lib/api';
import { formatDate, formatRelative } from '@/lib/formatters';
import { ROLE_LABELS } from '@/lib/permissions';
import { initials } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import type { User } from '@/lib/types';

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(120),
  phone: z.string().max(40).optional(),
  jobTitle: z.string().max(120).optional(),
  avatarUrl: z.string().max(500).optional(),
  timezone: z.string().max(60).optional(),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z
      .string()
      .min(8, 'Use at least 8 characters')
      .refine((value) => /[A-Z]/.test(value), 'Add an uppercase letter')
      .refine((value) => /[a-z]/.test(value), 'Add a lowercase letter')
      .refine((value) => /[0-9]/.test(value), 'Add a number'),
    confirmPassword: z.string().min(1, 'Confirm the new password'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

type ProfileValues = z.infer<typeof profileSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;

export default function ProfilePage() {
  const { user, activeOrganization, membership, organizations } = useAuth();
  const setSession = useAuthStore((state) => state.setSession);
  const clear = useAuthStore((state) => state.clear);
  const queryClient = useQueryClient();
  const router = useRouter();
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name ?? '',
      phone: user?.phone ?? '',
      jobTitle: user?.jobTitle ?? '',
      avatarUrl: user?.avatarUrl ?? '',
      timezone: user?.timezone ?? 'UTC',
    },
  });

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  useEffect(() => {
    if (user) {
      profileForm.reset({
        name: user.name ?? '',
        phone: user.phone ?? '',
        jobTitle: user.jobTitle ?? '',
        avatarUrl: user.avatarUrl ?? '',
        timezone: user.timezone ?? 'UTC',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const saveProfile = useMutation({
    mutationFn: (values: ProfileValues) =>
      api.patch<User>('/auth/profile', {
        name: values.name,
        phone: values.phone || undefined,
        jobTitle: values.jobTitle || undefined,
        avatarUrl: values.avatarUrl || undefined,
        timezone: values.timezone || undefined,
      }),
    onSuccess: async (updated) => {
      notifySuccess('Profile updated');
      setProfileError(null);
      if (user) {
        setSession({
          user: { ...user, ...updated },
          activeOrganization,
          membership,
          organizations,
        });
      }
      await queryClient.invalidateQueries({ queryKey: ['/auth/me'] });
    },
    onError: (error) => {
      setProfileError(
        error instanceof ApiRequestError ? error.message : 'Unable to save your profile.',
      );
    },
  });

  const changePassword = useMutation({
    mutationFn: (values: PasswordValues) =>
      api.post('/auth/change-password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      }),
    onSuccess: () => {
      notifySuccess('Password changed. Please sign in again.');
      setAccessToken(null);
      clear();
      queryClient.clear();
      router.replace('/login');
    },
    onError: (error) => {
      setPasswordError(
        error instanceof ApiRequestError ? error.message : 'Unable to change your password.',
      );
    },
  });

  const logoutAll = useMutation({
    mutationFn: () => api.post('/auth/logout-all', {}),
    onSuccess: () => {
      notifySuccess('All sessions signed out');
      setAccessToken(null);
      clear();
      queryClient.clear();
      router.replace('/login');
    },
    onError: (error) => notifyError(error),
  });

  if (!user) return null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="My profile"
        description="Your personal details, security settings and active workspace membership."
      />

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <Avatar className="size-14">
                {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.name} /> : null}
                <AvatarFallback>{initials(user.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold">{user.name}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                {user.isSuperAdmin && (
                  <Badge variant="warning" className="mt-1.5">
                    Platform administrator
                  </Badge>
                )}
              </div>
            </div>

            <div className="mt-5 space-y-3 border-t border-border/70 pt-4 text-xs">
              <InfoRow label="Workspace" value={activeOrganization?.name ?? '—'} />
              <InfoRow
                label="Role"
                value={membership ? ROLE_LABELS[membership.role] ?? membership.role : '—'}
              />
              <InfoRow label="Title" value={membership?.title || user.jobTitle || '—'} />
              <InfoRow label="Last sign-in" value={user.lastLoginAt ? formatRelative(user.lastLoginAt) : '—'} />
              <InfoRow label="Member since" value={formatDate(user.createdAt)} />
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-destructive/10 text-destructive">
                <LogOut className="size-4" />
              </span>
              <div>
                <p className="text-sm font-semibold">Session security</p>
                <p className="text-[11px] text-muted-foreground">
                  Sign out of every device using this account. You will need to sign in again here too.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              className="mt-4 w-full text-destructive"
              loading={logoutAll.isPending}
              onClick={() => logoutAll.mutate()}
            >
              <LogOut />
              Sign out all sessions
            </Button>
          </Card>

          <Card className="p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="size-4" />
              </span>
              <div>
                <p className="text-sm font-semibold">Account protection</p>
                <p className="text-[11px] text-muted-foreground">
                  Use a unique password and rotate it regularly. Changing your password signs out all
                  other sessions.
                </p>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <UserRound className="size-4" />
              </span>
              <div>
                <p className="text-sm font-semibold">Personal information</p>
                <p className="text-[11px] text-muted-foreground">
                  This information is visible to other members of your workspace.
                </p>
              </div>
            </div>

            {profileError && (
              <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-xs font-medium text-destructive">
                {profileError}
              </div>
            )}

            <form
              onSubmit={profileForm.handleSubmit((values) => saveProfile.mutate(values))}
              className="mt-4 space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Full name" htmlFor="profile-name" required error={profileForm.formState.errors.name?.message}>
                  <Input id="profile-name" {...profileForm.register('name')} />
                </FormField>
                <FormField label="Email" htmlFor="profile-email" hint="Contact an administrator to change your email.">
                  <Input id="profile-email" value={user.email} disabled readOnly />
                </FormField>
                <FormField label="Phone" htmlFor="profile-phone">
                  <Input id="profile-phone" type="tel" {...profileForm.register('phone')} />
                </FormField>
                <FormField label="Job title" htmlFor="profile-title">
                  <Input id="profile-title" {...profileForm.register('jobTitle')} />
                </FormField>
                <FormField label="Timezone" htmlFor="profile-timezone">
                  <Input id="profile-timezone" placeholder="UTC" {...profileForm.register('timezone')} />
                </FormField>
                <FormField label="Avatar URL" htmlFor="profile-avatar">
                  <Input id="profile-avatar" placeholder="https://…" {...profileForm.register('avatarUrl')} />
                </FormField>
              </div>
              <div className="flex justify-end">
                <Button type="submit" loading={profileForm.formState.isSubmitting}>
                  <Save />
                  Save profile
                </Button>
              </div>
            </form>
          </Card>

          <Card className="p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <KeyRound className="size-4" />
              </span>
              <div>
                <p className="text-sm font-semibold">Change password</p>
                <p className="text-[11px] text-muted-foreground">
                  At least 8 characters with upper and lower case letters and a number.
                </p>
              </div>
            </div>

            {passwordError && (
              <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-xs font-medium text-destructive">
                {passwordError}
              </div>
            )}

            <form
              onSubmit={passwordForm.handleSubmit((values) => changePassword.mutate(values))}
              className="mt-4 space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label="Current password"
                  htmlFor="current-password"
                  required
                  colSpan={2}
                  error={passwordForm.formState.errors.currentPassword?.message}
                >
                  <Input
                    id="current-password"
                    type="password"
                    autoComplete="current-password"
                    {...passwordForm.register('currentPassword')}
                  />
                </FormField>
                <FormField
                  label="New password"
                  htmlFor="new-password"
                  required
                  error={passwordForm.formState.errors.newPassword?.message}
                >
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    {...passwordForm.register('newPassword')}
                  />
                </FormField>
                <FormField
                  label="Confirm new password"
                  htmlFor="confirm-password"
                  required
                  error={passwordForm.formState.errors.confirmPassword?.message}
                >
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    {...passwordForm.register('confirmPassword')}
                  />
                </FormField>
              </div>
              <div className="flex justify-end">
                <Button type="submit" variant="outline" loading={passwordForm.formState.isSubmitting}>
                  <KeyRound />
                  Update password
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-40 truncate text-right font-medium">{value}</span>
    </div>
  );
}
