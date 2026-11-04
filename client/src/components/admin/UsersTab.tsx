'use client';

import { Badge, StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/data/data-table';
import { Pagination } from '@/components/data/pagination';
import { SearchInput } from '@/components/data/search-input';
import { formatDateTime } from '@/lib/formatters';
import { initials } from '@/lib/utils';
import type { PaginationMeta } from '@/lib/types';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  status?: string;
  isSuperAdmin: boolean;
  lastLoginAt?: string;
  createdAt?: string;
  avatarUrl?: string;
}

export function UsersTab({
  users,
  meta,
  loading,
  search,
  page,
  limit,
  onSearch,
  onPage,
  onLimit,
  onToggle,
}: {
  users: AdminUser[];
  meta: PaginationMeta | null;
  loading?: boolean;
  search: string;
  page: number;
  limit: number;
  onSearch: (v: string) => void;
  onPage: (v: number) => void;
  onLimit: (v: number) => void;
  onToggle: (u: AdminUser) => void;
}) {
  return (
    <div className="space-y-4">
      <SearchInput value={search} onChange={onSearch} placeholder="Search users by name or email…" className="w-full sm:max-w-xs" />

      <Card className="overflow-hidden">
        <DataTable<AdminUser>
          columns={[
            {
              key: 'user',
              header: 'User',
              cell: (u) => (
                <div className="flex items-center gap-3">
                  <div className="grid size-9 place-items-center rounded-full bg-muted text-xs font-semibold">
                    {initials(u.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{u.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{u.email}</p>
                  </div>
                </div>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              cell: (u) => <StatusBadge status={u.status} />,
            },
            {
              key: 'platform',
              header: 'Platform role',
              cell: (u) => (
                <Badge variant={u.isSuperAdmin ? 'warning' : 'outline'}>
                  {u.isSuperAdmin ? 'Super admin' : 'User'}
                </Badge>
              ),
            },
            {
              key: 'lastLogin',
              header: 'Last login',
              cell: (u) => <span className="text-[11px] text-muted-foreground">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Never'}</span>,
            },
            {
              key: 'created',
              header: 'Created',
              cell: (u) => <span className="text-[11px] text-muted-foreground">{u.createdAt ? formatDateTime(u.createdAt) : '—'}</span>,
            },
            {
              key: 'actions',
              header: '',
              className: 'w-32 text-right',
              cell: (u) => (
                <Button variant="outline" size="sm" onClick={() => onToggle(u)}>
                  <span className="sr-only">Toggle super admin</span>
                  {u.isSuperAdmin ? 'Revoke' : 'Grant'}
                </Button>
              ),
            },
          ]}
          rows={users}
          loading={loading}
          emptyTitle="No users found"
          emptyDescription="Users appear here once they register."
        />
        <Pagination meta={meta} page={page} limit={limit} onPageChange={onPage} onLimitChange={onLimit} />
      </Card>
    </div>
  );
}