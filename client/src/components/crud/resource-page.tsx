'use client';

import { useState, type ReactNode } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { DataColumn } from '@/components/data/data-table';
import { DataTable } from '@/components/data/data-table';
import { Pagination } from '@/components/data/pagination';
import { SearchInput } from '@/components/data/search-input';
import { ConfirmDialog } from '@/components/data/confirm-dialog';
import { RowActions, type RowActionItem } from '@/components/data/row-actions';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useDebounce } from '@/hooks/use-debounce';
import { useDeleteResource, useResourceList, notifySuccess } from '@/hooks/use-resource';
import type { ListParams } from '@/lib/types';

export interface ResourceFormRendererProps<T> {
  record: T | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface ResourcePageProps<T extends { id?: string }> {
  title: string;
  description?: string;
  endpoint: string;
  columns: DataColumn<T>[];
  renderForm?: (props: ResourceFormRendererProps<T>) => ReactNode;
  rowActions?: (row: T) => RowActionItem[];
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  createLabel?: string;
  searchPlaceholder?: string;
  extraParams?: ListParams;
  toolbar?: ReactNode;
  headerActions?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  deleteTitle?: string;
  deleteDescription?: (row: T) => string;
  onRowClick?: (row: T) => void;
  allowSearch?: boolean;
  defaultLimit?: number;
  refreshKeys?: string[];
}

export function ResourcePage<T extends { id?: string }>({
  title,
  description,
  endpoint,
  columns,
  renderForm,
  rowActions,
  canCreate = false,
  canEdit = true,
  canDelete = false,
  createLabel = 'New record',
  searchPlaceholder = 'Search…',
  extraParams,
  toolbar,
  headerActions,
  emptyTitle,
  emptyDescription,
  deleteTitle = 'Delete record',
  deleteDescription = () => 'This action soft-deletes the record. Continue?',
  onRowClick,
  allowSearch = true,
  defaultLimit = 20,
  refreshKeys = [],
}: ResourcePageProps<T>) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(defaultLimit);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<T | null>(null);
  const debouncedSearch = useDebounce(search, 300);

  const query = useResourceList<T>(endpoint, {
    page,
    limit,
    search: debouncedSearch || undefined,
    ...extraParams,
  });
  const remove = useDeleteResource(endpoint, refreshKeys);

  const rows = query.data?.data ?? [];
  const hasActions = Boolean(renderForm || canDelete || rowActions);

  const actionColumn: DataColumn<T> = {
    key: '__actions',
    header: '',
    headerClassName: 'text-right',
    className: 'w-12 text-right',
    cell: (row) => {
      const items: RowActionItem[] = [...(rowActions?.(row) ?? [])];
      if (renderForm && canEdit) {
        items.push({
          label: 'Edit',
          icon: Pencil,
          onSelect: () => {
            setEditing(row);
            setFormOpen(true);
          },
        });
      }
      if (canDelete) {
        items.push({
          label: 'Delete',
          icon: Trash2,
          destructive: true,
          separatorBefore: true,
          onSelect: () => setDeleteTarget(row),
        });
      }
      return <RowActions items={items} />;
    },
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={title}
        description={description}
        actions={
          <>
            {headerActions}
            {canCreate && renderForm && (
              <Button
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus />
                {createLabel}
              </Button>
            )}
          </>
        }
      />

      <Card className="overflow-hidden">
        {(allowSearch || toolbar) && (
          <div className="flex flex-col gap-2 border-b border-border/70 p-4 sm:flex-row sm:items-center sm:justify-between">
            {allowSearch ? (
              <SearchInput
                value={search}
                onChange={(value) => {
                  setSearch(value);
                  setPage(1);
                }}
                placeholder={searchPlaceholder}
                className="w-full sm:max-w-xs"
              />
            ) : (
              <span />
            )}
            {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
          </div>
        )}

        <DataTable<T>
          columns={hasActions ? [...columns, actionColumn] : columns}
          rows={rows}
          loading={query.isLoading}
          emptyTitle={emptyTitle ?? `No ${title.toLowerCase()} yet`}
          emptyDescription={emptyDescription}
          emptyAction={
            canCreate && renderForm ? (
              <Button
                variant="outline"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus />
                {createLabel}
              </Button>
            ) : undefined
          }
          onRowClick={onRowClick}
        />

        <Pagination
          meta={query.data?.meta}
          page={page}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={(value) => {
            setLimit(value);
            setPage(1);
          }}
        />
      </Card>

      {renderForm?.({ record: editing, open: formOpen, onOpenChange: setFormOpen })}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={deleteTitle}
        description={deleteTarget ? deleteDescription(deleteTarget) : undefined}
        confirmLabel="Delete"
        loading={remove.isPending}
        onConfirm={async () => {
          if (!deleteTarget?.id) return;
          await remove.mutateAsync(deleteTarget.id);
          notifySuccess('Record deleted');
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
