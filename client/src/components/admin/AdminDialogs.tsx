'use client';
import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { FormField } from '@/components/data/form-field';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { AdminOrganization } from '@/components/admin/OrganizationsTab';
import type { CreateOrgValues, EditOrgValues } from '@/lib/schemas/admin';
import { createOrgSchema, editOrgSchema } from '@/lib/schemas/admin';
export function CreateOrgDialog({
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

export function EditOrgDialog({
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
