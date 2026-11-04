'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Building2, Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, setAccessToken } from '@/lib/api';
import type { SessionPayload } from '@/lib/types';
import { useAuthStore } from '@/stores/auth-store';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export function OrgSwitcher() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const organization = useAuthStore((state) => state.activeOrganization);
  const organizations = useAuthStore((state) => state.organizations);
  const setSession = useAuthStore((state) => state.setSession);
  const [switching, setSwitching] = useState<string | null>(null);

  async function switchOrganization(organizationId: string) {
    if (organizationId === organization?.id) return;
    setSwitching(organizationId);
    try {
      const session = await api.post<SessionPayload>('/auth/switch-organization', { organizationId });
      if (session.accessToken) setAccessToken(session.accessToken);
      setSession(session);
      await queryClient.invalidateQueries();
      toast.success(`Switched to ${session.activeOrganization?.name ?? 'workspace'}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not switch workspace');
    } finally {
      setSwitching(null);
    }
  }

  if (!organization) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex h-9 max-w-52 items-center gap-2 rounded-lg border border-border bg-card px-2.5 text-left text-sm transition-colors hover:bg-accent">
          <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <Building2 className="size-3.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold leading-tight">
              {organization.name}
            </span>
            <span className="block truncate text-[10px] capitalize leading-tight text-muted-foreground">
              {organization.plan} plan
            </span>
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {organizations.map((item) => (
          <DropdownMenuItem
            key={item.id}
            onSelect={() => void switchOrganization(item.id)}
            className="gap-2"
          >
            <span className="grid size-6 place-items-center rounded-md bg-muted text-[10px] font-semibold uppercase">
              {item.name.slice(0, 2)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{item.name}</span>
              <span className="block truncate text-[10px] capitalize text-muted-foreground">
                {item.role?.replace(/_/g, ' ') ?? item.plan}
              </span>
            </span>
            {switching === item.id ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : item.id === organization.id ? (
              <Check className="size-4 text-primary" />
            ) : null}
          </DropdownMenuItem>
        ))}
        {organizations.length === 0 && (
          <p className="px-2 py-3 text-sm text-muted-foreground">No workspaces available</p>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href="/settings/organization" className={cn('cursor-pointer')}>
            Workspace settings
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
