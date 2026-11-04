'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, Building2 } from 'lucide-react';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/data/form-field';
import { api, setAccessToken } from '@/lib/api';
import { notifyError } from '@/hooks/use-resource';
import { useAuthStore } from '@/stores/auth-store';
import type { SessionPayload } from '@/lib/types';

const schema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
  organizationSlug: z.string().trim().max(63).optional(),
});

type FormValues = z.infer<typeof schema>;

const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@aurora.com' },
  { label: 'Manager', email: 'manager@aurora.com' },
  { label: 'Accountant', email: 'accountant@aurora.com' },
  { label: 'Employee', email: 'employee@aurora.com' },
];

export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '', organizationSlug: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      const session = await api.post<SessionPayload>('/auth/login', {
        email: values.email,
        password: values.password,
        organizationSlug: values.organizationSlug || undefined,
      });
      if (session.accessToken) setAccessToken(session.accessToken);
      setSession(session);
      router.replace('/dashboard');
    } catch (error) {
      notifyError(error);
    } finally {
      setSubmitting(false);
    }
  });

  const fillDemo = (email: string) => {
    form.setValue('email', email);
    form.setValue('password', 'Admin@12345');
  };

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in to your workspace"
      subtitle="Use your company account to access Aurora ERP."
      footer={
        <>
          New to Aurora?{' '}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Create a workspace
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <FormField label="Work email" htmlFor="email" error={form.formState.errors.email?.message} required>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="email" type="email" autoComplete="email" className="pl-9" placeholder="you@company.com" {...form.register('email')} />
          </div>
        </FormField>

        <FormField label="Password" htmlFor="password" error={form.formState.errors.password?.message} required>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              className="pl-9 pr-9"
              placeholder="••••••••"
              {...form.register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </FormField>

        <FormField
          label="Workspace slug"
          htmlFor="organizationSlug"
          hint="Optional. Leave blank to use your primary workspace."
          error={form.formState.errors.organizationSlug?.message}
        >
          <div className="relative">
            <Building2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="organizationSlug" className="pl-9" placeholder="acme" {...form.register('organizationSlug')} />
          </div>
        </FormField>

        <Button type="submit" className="w-full" loading={submitting}>
          Sign in
          <ArrowRight />
        </Button>
      </form>

      <div className="mt-7 rounded-xl border border-border/80 bg-muted/40 p-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Demo workspace
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Password <span className="font-mono font-medium text-foreground">Admin@12345</span> for all
          demo accounts.
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => fillDemo(account.email)}
              className="rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium transition-colors hover:border-primary/50 hover:text-primary"
            >
              {account.label}
            </button>
          ))}
        </div>
      </div>
    </AuthShell>
  );
}
