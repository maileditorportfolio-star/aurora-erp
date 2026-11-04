'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { api, buildQuery } from '@/lib/api';
import { formatRelative } from '@/lib/formatters';
import type { NotificationRecord, PaginationMeta } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const TYPE_DOT: Record<string, string> = {
  info: 'bg-sky-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error: 'bg-destructive',
};

export function NotificationsMenu() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'menu'],
    queryFn: () =>
      api.list<NotificationRecord>(`/notifications${buildQuery({ limit: 6, sort: '-createdAt' })}`),
    refetchInterval: 60_000,
  });

  const unread = data?.meta?.unread ?? data?.data.filter((item) => !item.isRead).length ?? 0;

  const markAll = useMutation({
    mutationFn: () => api.patch('/notifications/read-all', {}),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="relative" aria-label="Notifications">
          <Bell />
          {unread > 0 && (
            <span className="absolute right-0.5 top-0.5 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-4 text-destructive-foreground">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2.5">
          <div>
            <p className="text-sm font-semibold">Notifications</p>
            <p className="text-[11px] text-muted-foreground">
              {unread > 0 ? `${unread} unread` : 'You are all caught up'}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-[11px]"
            onClick={() => markAll.mutate()}
            disabled={!unread || markAll.isPending}
          >
            <CheckCheck className="size-3.5" />
            Mark all
          </Button>
        </div>
        <DropdownMenuSeparator className="mx-0" />
        <div className="max-h-80 overflow-y-auto p-1 scrollbar-thin">
          {isLoading && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Loading…</p>
          )}
          {!isLoading && !data?.data.length && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No notifications yet
            </p>
          )}
          {data?.data.map((notification) => (
            <Link
              key={notification.id}
              href={notification.link || '/notifications'}
              className={cn(
                'flex gap-2.5 rounded-md px-2.5 py-2.5 transition-colors hover:bg-accent',
                !notification.isRead && 'bg-primary/[0.04]',
              )}
            >
              <span
                className={cn(
                  'mt-1.5 size-1.5 shrink-0 rounded-full',
                  TYPE_DOT[notification.type] ?? 'bg-muted-foreground',
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{notification.title}</span>
                <span className="line-clamp-2 block text-[11px] text-muted-foreground">
                  {notification.message}
                </span>
                <span className="mt-0.5 block text-[10px] text-muted-foreground/80">
                  {formatRelative(notification.createdAt)}
                </span>
              </span>
            </Link>
          ))}
        </div>
        <DropdownMenuSeparator className="mx-0" />
        <Link
          href="/notifications"
          className="block px-3 py-2.5 text-center text-xs font-medium text-primary hover:underline"
        >
          View all notifications
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export type { PaginationMeta };
