'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Building2, Check, Loader2, MapPin, Palette, ReceiptText, Save } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { FormField } from '@/components/data/form-field';
import { PageHeader } from '@/components/layout/page-header';
import { useAuth } from '@/hooks/use-auth';
import { notifySuccess } from '@/hooks/use-resource';
import { ApiRequestError, api } from '@/lib/api';
import { formatNumber } from '@/lib/formatters';
import { PERMISSIONS } from '@/lib/permissions';
import { useAuthStore } from '@/stores/auth-store';
import type { Organization } from '@/lib/types';

interface OrgStats {
  members: number;
  products: number;
  customers: number;
  invoices: number;
  employees: number;
}

const optionalString = z.string().max(200).optional();

const organizationSchema = z.object({
  name: z.string().trim().min(2, 'Enter a workspace name').max(120),
  legalName: optionalString,
  email: z.string().trim().email('Enter a valid email').optional().or(z.literal('')),
  phone: z.string().max(40).optional(),
  appName: z.string().max(80).optional(),
  logoUrl: z.string().max(500).optional(),
  brandColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Use a 6-digit hex colour')
    .optional()
    .or(z.literal('')),
  plan: z.enum(['starter', 'professional', 'enterprise']).optional(),
  settings: z.object({
    currency: z.string().length(3, 'Use a 3-letter currency code'),
    timezone: z.string().max(60).optional(),
    locale: z.string().max(20).optional(),
    dateFormat: z.string().max(30).optional(),
    taxRate: z
      .string()
      .optional()
      .refine((value) => !value || (Number(value) >= 0 && Number(value) <= 100), 'Tax must be 0–100'),
    invoicePrefix: z.string().max(10).optional(),
    quotationPrefix: z.string().max(10).optional(),
    salesOrderPrefix: z.string().max(10).optional(),
    purchaseOrderPrefix: z.string().max(10).optional(),
    fiscalYearStart: z
      .string()
      .optional()
      .refine((value) => !value || (Number(value) >= 1 && Number(value) <= 12), 'Month must be 1–12'),
    invoiceDueDays: z
      .string()
      .optional()
      .refine((value) => !value || (Number(value) >= 0 && Number(value) <= 365), 'Due days must be 0–365'),
    industry: z.string().max(80).optional(),
    website: z.string().max(200).optional(),
    address: z.object({
      street: optionalString,
      city: z.string().max(100).optional(),
      state: z.string().max(100).optional(),
      country: z.string().max(100).optional(),
      postalCode: z.string().max(30).optional(),
    }),
  }),
});

type OrganizationValues = z.infer<typeof organizationSchema>;

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Africa/Lagos',
  'Africa/Johannesburg',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'AED', 'CAD', 'AUD', 'NGN', 'ZAR', 'INR', 'SGD', 'JPY'];

function orgToValues(org: Organization): OrganizationValues {
  return {
    name: org.name ?? '',
    legalName: org.legalName ?? '',
    email: org.email ?? '',
    phone: org.phone ?? '',
    appName: org.appName ?? '',
    logoUrl: org.logoUrl ?? '',
    brandColor: org.brandColor ?? '#4f46e5',
    plan: (org.plan as OrganizationValues['plan']) ?? 'professional',
    settings: {
      currency: org.settings?.currency ?? 'USD',
      timezone: org.settings?.timezone ?? 'UTC',
      locale: org.settings?.locale ?? 'en-US',
      dateFormat: org.settings?.dateFormat ?? 'MMM d, yyyy',
      taxRate: String(org.settings?.taxRate ?? 0),
      invoicePrefix: org.settings?.invoicePrefix ?? 'INV',
      quotationPrefix: org.settings?.quotationPrefix ?? 'QUO',
      salesOrderPrefix: org.settings?.salesOrderPrefix ?? 'SO',
      purchaseOrderPrefix: org.settings?.purchaseOrderPrefix ?? 'PO',
      fiscalYearStart: String(org.settings?.fiscalYearStart ?? 1),
      invoiceDueDays: String(org.settings?.invoiceDueDays ?? 30),
      industry: org.settings?.industry ?? '',
      website: org.settings?.website ?? '',
      address: {
        street: org.settings?.address?.street ?? '',
        city: org.settings?.address?.city ?? '',
        state: org.settings?.address?.state ?? '',
        country: org.settings?.address?.country ?? '',
        postalCode: org.settings?.address?.postalCode ?? '',
      },
    },
  };
}

export default function OrganizationSettingsPage() {
  const auth = useAuth();
  const setSession = useAuthStore((state) => state.setSession);
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const organization = useQuery<Organization>({
    queryKey: ['/organization', 'current'],
    queryFn: () => api.get<Organization>('/organization'),
  });

  const stats = useQuery<OrgStats>({
    queryKey: ['/organization', 'stats'],
    queryFn: () => api.get<OrgStats>('/organization/stats'),
  });

  const form = useForm<OrganizationValues>({
    resolver: zodResolver(organizationSchema),
    defaultValues: organization.data
      ? orgToValues(organization.data)
      : orgToValues((auth.activeOrganization ?? {}) as Organization),
  });

  useEffect(() => {
    if (organization.data) {
      form.reset(orgToValues(organization.data));
      setServerError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization.data]);

  const save = useMutation({
    mutationFn: (values: OrganizationValues) => {
      const payload: Record<string, unknown> = {
        name: values.name,
        legalName: values.legalName || '',
        email: values.email || '',
        phone: values.phone || '',
        appName: values.appName || undefined,
        logoUrl: values.logoUrl || '',
        brandColor: values.brandColor || undefined,
        settings: {
          currency: values.settings.currency.toUpperCase(),
          timezone: values.settings.timezone,
          locale: values.settings.locale,
          dateFormat: values.settings.dateFormat,
          taxRate: Number(values.settings.taxRate || 0),
          invoicePrefix: values.settings.invoicePrefix,
          quotationPrefix: values.settings.quotationPrefix,
          salesOrderPrefix: values.settings.salesOrderPrefix,
          purchaseOrderPrefix: values.settings.purchaseOrderPrefix,
          fiscalYearStart: Number(values.settings.fiscalYearStart || 1),
          invoiceDueDays: Number(values.settings.invoiceDueDays || 0),
          industry: values.settings.industry || undefined,
          website: values.settings.website || undefined,
          address: {
            street: values.settings.address.street || undefined,
            city: values.settings.address.city || undefined,
            state: values.settings.address.state || undefined,
            country: values.settings.address.country || undefined,
            postalCode: values.settings.address.postalCode || undefined,
          },
        },
      };
      if (auth.user?.isSuperAdmin && values.plan) payload.plan = values.plan;
      return api.patch<Organization>('/organization', payload);
    },
    onSuccess: async (updated) => {
      notifySuccess('Organization settings saved');
      await queryClient.invalidateQueries({ queryKey: ['/organization'] });
      if (auth.user) {
        const nextOrganization = {
          ...(auth.activeOrganization ?? updated),
          ...updated,
          role: auth.activeOrganization?.role,
        } as Organization;
        setSession({
          user: auth.user,
          activeOrganization: nextOrganization,
          membership: auth.membership,
          organizations: auth.organizations.map((item) =>
            item.id === updated.id ? { ...item, ...updated, role: item.role } : item,
          ),
        });
      }
    },
    onError: (error) => {
      setServerError(
        error instanceof ApiRequestError ? error.message : 'Unable to save organization settings.',
      );
    },
  });

  const canWrite = auth.can(PERMISSIONS.ORGANIZATION_WRITE);

  if (organization.isLoading) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading workspace…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Organization settings"
        description="Branding, regional defaults, numbering and billing details for this workspace."
        actions={
          canWrite ? (
            <Button type="submit" form="organization-form" loading={save.isPending}>
              <Save />
              Save changes
            </Button>
          ) : (
            <Badge variant="outline">Read only</Badge>
          )
        }
      />

      {!canWrite && (
        <div className="rounded-lg border border-border/80 bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
          You have view-only access to organization settings. Ask an administrator for the
          <span className="mx-1 font-medium text-foreground">organization:write</span>
          permission.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Members" value={stats.data?.members ?? 0} />
        <Stat label="Products" value={stats.data?.products ?? 0} />
        <Stat label="Customers" value={stats.data?.customers ?? 0} />
        <Stat label="Invoices" value={stats.data?.invoices ?? 0} />
        <Stat label="Employees" value={stats.data?.employees ?? 0} />
      </div>

      {serverError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-xs font-medium text-destructive">
          {serverError}
        </div>
      )}

      <form
        id="organization-form"
        onSubmit={form.handleSubmit((values) => save.mutate(values))}
        className="space-y-5"
      >
        <Card className="p-5">
          <SectionHeader
            icon={<Building2 className="size-4" />}
            title="Workspace identity"
            description="Shown across the app, documents and emails."
          />
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <FormField label="Workspace name" htmlFor="org-name" required error={form.formState.errors.name?.message}>
              <Input id="org-name" disabled={!canWrite} {...form.register('name')} />
            </FormField>
            <FormField label="Legal name" htmlFor="org-legal-name">
              <Input id="org-legal-name" disabled={!canWrite} {...form.register('legalName')} />
            </FormField>
            <FormField label="App name" htmlFor="org-app-name" hint="Displayed in the sidebar and browser title.">
              <Input id="org-app-name" disabled={!canWrite} {...form.register('appName')} />
            </FormField>
            <FormField label="Billing email" htmlFor="org-email" error={form.formState.errors.email?.message}>
              <Input id="org-email" type="email" disabled={!canWrite} {...form.register('email')} />
            </FormField>
            <FormField label="Phone" htmlFor="org-phone">
              <Input id="org-phone" type="tel" disabled={!canWrite} {...form.register('phone')} />
            </FormField>
            <FormField
              label="Brand colour"
              htmlFor="org-brand"
              error={form.formState.errors.brandColor?.message}
              hint="Used for accents and document headers."
            >
              <div className="flex items-center gap-2">
                <Input
                  id="org-brand"
                  type="color"
                  disabled={!canWrite}
                  className="h-9 w-14 p-1"
                  {...form.register('brandColor')}
                />
                <Input disabled={!canWrite} className="flex-1" {...form.register('brandColor')} />
              </div>
            </FormField>
            <FormField label="Logo URL" htmlFor="org-logo" colSpan={2}>
              <Input id="org-logo" disabled={!canWrite} placeholder="https://…" {...form.register('logoUrl')} />
            </FormField>
            <FormField
              label="Plan"
              htmlFor="org-plan"
              hint={auth.user?.isSuperAdmin ? 'Platform administrators can change the plan.' : 'Contact support to change your plan.'}
            >
              <Select id="org-plan" disabled={!canWrite || !auth.user?.isSuperAdmin} {...form.register('plan')}>
                <option value="starter">Starter</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
              </Select>
            </FormField>
          </div>
        </Card>

        <Card className="p-5">
          <SectionHeader
            icon={<Palette className="size-4" />}
            title="Regional & finance defaults"
            description="Currency, tax and fiscal settings used in calculations and reports."
          />
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <FormField label="Currency" htmlFor="org-currency" required error={form.formState.errors.settings?.currency?.message}>
              <Select id="org-currency" disabled={!canWrite} {...form.register('settings.currency')}>
                {CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Timezone" htmlFor="org-timezone">
              <Select id="org-timezone" disabled={!canWrite} {...form.register('settings.timezone')}>
                {TIMEZONES.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Locale" htmlFor="org-locale">
              <Input id="org-locale" disabled={!canWrite} placeholder="en-US" {...form.register('settings.locale')} />
            </FormField>
            <FormField label="Date format" htmlFor="org-date-format">
              <Select id="org-date-format" disabled={!canWrite} {...form.register('settings.dateFormat')}>
                {['MMM d, yyyy', 'dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd', 'd MMM yyyy'].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField
              label="Default tax rate (%)"
              htmlFor="org-tax"
              error={form.formState.errors.settings?.taxRate?.message}
            >
              <Input id="org-tax" type="number" min={0} max={100} step="0.01" disabled={!canWrite} {...form.register('settings.taxRate')} />
            </FormField>
            <FormField
              label="Fiscal year starts"
              htmlFor="org-fiscal"
              error={form.formState.errors.settings?.fiscalYearStart?.message}
            >
              <Select id="org-fiscal" disabled={!canWrite} {...form.register('settings.fiscalYearStart')}>
                {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                  <option key={month} value={String(month)}>
                    {new Date(2020, month - 1, 1).toLocaleDateString('en-US', { month: 'long' })}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField
              label="Invoice due days"
              htmlFor="org-due-days"
              error={form.formState.errors.settings?.invoiceDueDays?.message}
            >
              <Input id="org-due-days" type="number" min={0} max={365} disabled={!canWrite} {...form.register('settings.invoiceDueDays')} />
            </FormField>
            <FormField label="Industry" htmlFor="org-industry">
              <Input id="org-industry" disabled={!canWrite} placeholder="Manufacturing, retail…" {...form.register('settings.industry')} />
            </FormField>
            <FormField label="Website" htmlFor="org-website">
              <Input id="org-website" disabled={!canWrite} placeholder="https://…" {...form.register('settings.website')} />
            </FormField>
          </div>
        </Card>

        <Card className="p-5">
          <SectionHeader
            icon={<ReceiptText className="size-4" />}
            title="Document numbering"
            description="Prefixes used before auto-incrementing document numbers."
          />
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <FormField label="Invoice prefix" htmlFor="org-invoice-prefix">
              <Input id="org-invoice-prefix" disabled={!canWrite} {...form.register('settings.invoicePrefix')} />
            </FormField>
            <FormField label="Quotation prefix" htmlFor="org-quotation-prefix">
              <Input id="org-quotation-prefix" disabled={!canWrite} {...form.register('settings.quotationPrefix')} />
            </FormField>
            <FormField label="Sales order prefix" htmlFor="org-sales-prefix">
              <Input id="org-sales-prefix" disabled={!canWrite} {...form.register('settings.salesOrderPrefix')} />
            </FormField>
            <FormField label="Purchase order prefix" htmlFor="org-purchase-prefix">
              <Input id="org-purchase-prefix" disabled={!canWrite} {...form.register('settings.purchaseOrderPrefix')} />
            </FormField>
          </div>
        </Card>

        <Card className="p-5">
          <SectionHeader
            icon={<MapPin className="size-4" />}
            title="Business address"
            description="Appears on invoices, quotations and purchase orders."
          />
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <FormField label="Street" htmlFor="org-street" colSpan={2}>
              <Input id="org-street" disabled={!canWrite} {...form.register('settings.address.street')} />
            </FormField>
            <FormField label="City" htmlFor="org-city">
              <Input id="org-city" disabled={!canWrite} {...form.register('settings.address.city')} />
            </FormField>
            <FormField label="State / region" htmlFor="org-state">
              <Input id="org-state" disabled={!canWrite} {...form.register('settings.address.state')} />
            </FormField>
            <FormField label="Country" htmlFor="org-country">
              <Input id="org-country" disabled={!canWrite} {...form.register('settings.address.country')} />
            </FormField>
            <FormField label="Postal code" htmlFor="org-postal">
              <Input id="org-postal" disabled={!canWrite} {...form.register('settings.address.postalCode')} />
            </FormField>
          </div>
        </Card>

        <div className="flex items-center justify-between rounded-xl border border-border/80 bg-card p-4">
          <div className="text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Workspace status</p>
            <p className="mt-0.5 flex items-center gap-2">
              <StatusBadge status={organization.data?.status} />
              <span className="capitalize">{organization.data?.plan ?? 'professional'} plan</span>
              <span className="font-mono text-[10px]">/{organization.data?.slug}</span>
            </p>
          </div>
          {canWrite && (
            <Button type="submit" form="organization-form" loading={save.isPending}>
              <Check />
              Save changes
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">{icon}</span>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-[11px] text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{formatNumber(value)}</p>
    </Card>
  );
}
