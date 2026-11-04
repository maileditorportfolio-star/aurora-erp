'use client';

import type { ReactNode } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/layout/empty-state';
import { cn } from '@/lib/utils';

export interface DataColumn<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
  align?: 'left' | 'right' | 'center';
}

export function DataTable<T extends { id?: string }>({
  columns,
  rows,
  loading,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  emptyAction,
  rowKey,
  onRowClick,
  footer,
}: {
  columns: DataColumn<T>[];
  rows: T[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  rowKey?: (row: T) => string;
  onRowClick?: (row: T) => void;
  footer?: ReactNode;
}) {
  if (loading) return <TableSkeleton rows={6} columns={Math.min(columns.length, 6)} />;
  if (!rows.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {columns.map((column) => (
            <TableHead
              key={column.key}
              className={cn(
                column.align === 'right' && 'text-right',
                column.align === 'center' && 'text-center',
                column.headerClassName,
              )}
            >
              {column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => (
          <TableRow
            key={rowKey?.(row) ?? row.id ?? index}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={onRowClick ? 'cursor-pointer' : undefined}
          >
            {columns.map((column) => (
              <TableCell
                key={column.key}
                className={cn(
                  column.align === 'right' && 'text-right',
                  column.align === 'center' && 'text-center',
                  column.className,
                )}
              >
                {column.cell(row)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
      {footer}
    </Table>
  );
}
