'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PaginationMeta } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

export function Pagination({
  meta,
  page,
  limit,
  onPageChange,
  onLimitChange,
}: {
  meta: PaginationMeta | null | undefined;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
}) {
  if (!meta) return null;
  const from = meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.page * meta.limit, meta.total);

  return (
    <div className="flex flex-col gap-3 border-t border-border/70 px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <p>
        Showing <span className="font-medium text-foreground">{from}</span>–
        <span className="font-medium text-foreground">{to}</span> of{' '}
        <span className="font-medium text-foreground">{meta.total}</span>
      </p>
      <div className="flex items-center gap-2">
        {onLimitChange && (
          <Select
            value={String(limit)}
            onChange={(event) => onLimitChange(Number(event.target.value))}
            className="h-8 w-20 text-xs"
            aria-label="Rows per page"
          >
            {[10, 20, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </Select>
        )}
        <Button
          variant="outline"
          size="icon-sm"
          disabled={!meta.hasPrev}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          aria-label="Previous page"
        >
          <ChevronLeft />
        </Button>
        <span className="min-w-16 text-center">
          Page {meta.page} of {meta.pages}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          disabled={!meta.hasNext}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
