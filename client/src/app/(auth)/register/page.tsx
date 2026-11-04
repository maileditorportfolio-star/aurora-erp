'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, Building2, Eye, EyeOff, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/data/form-field';
import { api, setAccessToken } from '@/lib/api';
import { notifyError } from '@/hooks/use-resource';
import { useAuthStore } from '@/stores/auth-store';
import type { SessionPayload } from '@/lib/types';

const schema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(120),
  email: z.string().trim().email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'Use at least 8 characters')
    .regex(/[A-Z]/, 'Include an uppercase letter')
    .regex(/[a-z]/, 'Include a lowercase letter')
    .regex(/[0-9]/, 'Include a number'),
  organizationName: z.string().trim().min(2, 'Enter your company name').max(120),
  slug: z
    .string()
    .trim()
    .max(63)
    .refine((value) => !value || /^[a-z0-9-]+$/.test(value), 'Use lowercase letters, numbers and hyphens only')
    .optional(),
});

type FormValues = z.infer<typeof schema>;

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export default function RegisterPage() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', organizationName: '', slug: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      const session = await api.post<SessionPayload>('/auth/register', {
        ...values,
        slug: values.slug || slugify(values.organizationName),
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

  return (
    <AuthShell
      eyebrow="Get started"
      title="Create your workspace"
      subtitle="Spin up an isolated Aurora workspace with a ready-to-use chart of accounts."
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Full name" htmlFor="name" error={form.formState.errors.name?.message} required>
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="name" className="pl-9" placeholder="Alex Morgan" {...form.register('name')} />
            </div>
          </FormField>

          <FormField label="Company name" htmlFor="organizationName" error={form.formState.errors.organizationName?.message} required>
            <div className="relative">
              <Building2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="organizationName"
                className="pl-9"
                placeholder="Acme Inc."
                {...form.register('organizationName', {
                  onChange: (event) => {
                    if (!form.getValues('slug')) {
                      form.setValue('slug', slugify(event.target.value));
                    }
                  },
                })}
              />
            </div>
          </FormField>
        </div>

        <FormField label="Work email" htmlFor="email" error={form.formState.errors.email?.message} required>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="email" type="email" autoComplete="email" className="pl-9" placeholder="you@company.com" {...form.register('email')} />
          </div>
        </FormField>

        <FormField label="Password" htmlFor="password" error={form.formState.errors.password?.message} hint="8+ characters with upper, lower and a number." required>
          <div className="relative">
            <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              className="pl-9 pr-9"
              placeholder="Create a strong password"
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
          htmlFor="slug"
          hint="Used in your API URLs. Lowercase letters, numbers and hyphens."
          error={form.formState.errors.slug?.message}
        >
          <div className="flex items-center gap-0 overflow-hidden rounded-lg border border-input bg-card shadow-xs focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25">
            <span className="border-r border-input bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
              aurora.app/
            </span>
            <input
              id="slug"
              className="h-9 w-full bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
              placeholder="acme"
              {...form.register('slug')}
            />
          </div>
        </FormField>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          By creating a workspace you agree to the Aurora ERP license terms. Your data is isolated
          from every other workspace.
        </p>

        <Button type="submit" className="w-full" loading={submitting}>
          Create workspace
          <ArrowRight />
        </Button>
      </form>
    </AuthShell>
  );
}
