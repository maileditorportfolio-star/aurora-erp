'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Bell, CheckCheck, CircleCheck, Info, Trash2, XCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Pagination } from '@/components/data/pagination';
import { EmptyState } from '@/components/layout/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { notifyError, notifySuccess, useResourceList } from '@/hooks/use-resource';
import { api } from '@/lib/api';
import { formatRelative } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { NotificationRecord, PaginationMeta } from '@/lib/types';

const TYPE_META: Record<
  string,
  { icon: typeof Info; className: string; label: string }
> = {
  info: { icon: Info, className: 'bg-sky-500/10 text-sky-600 dark:text-sky-400', label: 'Info' },
  success: {
    icon: CircleCheck,
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    label: 'Success',
  },
  warning: {
    icon: AlertTriangle,
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    label: 'Warning',
  },
  error: {
    icon: XCircle,
    className: 'bg-destructive/10 text-destructive',
    label: 'Alert',
  },
};

export default function NotificationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const list = useResourceList<NotificationRecord>('/notifications', {
    page,
    limit,
    unread: filter === 'unread' ? 'true' : undefined,
    sort: '-createdAt',
  });

  const meta = list.data?.meta as (PaginationMeta & { unread?: number }) | null;
  const unread = meta?.unread ?? (list.data?.data ?? []).filter((item) => !item.isRead).length;

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    await queryClient.invalidateQueries({ queryKey: ['notifications', 'menu'] });
  };

  const markRead = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`, {}),
    onSuccess: invalidate,
    onError: (error) => notifyError(error),
  });

  const markAll = useMutation({
    mutationFn: () => api.patch('/notifications/read-all', {}),
    onSuccess: async () => {
      notifySuccess('All notifications marked as read');
      await invalidate();
    },
    onError: (error) => notifyError(error),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/notifications/${id}`),
    onSuccess: async () => {
      notifySuccess('Notification removed');
      await invalidate();
    },
    onError: (error) => notifyError(error),
  });

  function openNotification(notification: NotificationRecord) {
    if (!notification.isRead) markRead.mutate(notification.id);
    if (notification.link) router.push(notification.link);
  }

  const rows = list.data?.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notifications"
        description="Alerts, approvals and system activity for this workspace."
        actions={
          <Button
            variant="outline"
            onClick={() => markAll.mutate()}
            disabled={unread === 0 || markAll.isPending}
            loading={markAll.isPending}
          >
            <CheckCheck />
            Mark all as read
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={filter}
          onValueChange={(value) => {
            setFilter(value as 'all' | 'unread');
            setPage(1);
          }}
        >
          <TabsList>
            <TabsTrigger value="all">All notifications</TabsTrigger>
            <TabsTrigger value="unread">
              Unread
              {unread > 0 && (
                <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold text-primary">
                  {unread}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <p className="text-[11px] text-muted-foreground">
          Notifications are retained for 90 days. Workspace-wide alerts are visible to everyone.
        </p>
      </div>

      <Card className="overflow-hidden">
        {list.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-lg bg-muted/60" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            description={
              filter === 'unread'
                ? 'You are all caught up. New alerts will appear here.'
                : 'Workspace activity and approval requests will show up here.'
            }
          />
        ) : (
          <div className="divide-y divide-border/60">
            {rows.map((notification) => {
              const type = TYPE_META[notification.type] ?? TYPE_META.info;
              const Icon = type.icon;
              return (
                <div
                  key={notification.id}
                  className={cn(
                    'group flex gap-3 px-4 py-3 transition-colors hover:bg-accent/40',
                    !notification.isRead && 'bg-primary/[0.035]',
                  )}
                >
                  <span className={cn('mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg', type.className)}>
                    <Icon className="size-4" />
                  </span>
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => openNotification(notification)}
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{notification.title}</span>
                      {!notification.isRead && <span className="size-1.5 rounded-full bg-primary" />}
                      <Badge variant="outline" className="text-[10px]">
                        {type.label}
                      </Badge>
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                      {notification.message}
                    </span>
                    <span className="mt-1 block text-[10px] text-muted-foreground/80">
                      {formatRelative(notification.createdAt)}
                      {notification.link ? ' · Click to open' : ''}
                    </span>
                  </button>
                  <div className="flex shrink-0 items-start gap-1">
                    {!notification.isRead && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => markRead.mutate(notification.id)}
                        aria-label="Mark as read"
                      >
                        <CheckCheck />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => remove.mutate(notification.id)}
                      aria-label="Delete notification"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Pagination
          meta={meta}
          page={page}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={(value) => {
            setLimit(value);
            setPage(1);
          }}
        />
      </Card>
    </div>
  );
}
