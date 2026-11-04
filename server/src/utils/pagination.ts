import type { PaginationMeta } from './response';

export interface PaginationInput {
  page: number;
  limit: number;
  skip: number;
  sort: Record<string, 1 | -1>;
  search: string;
  meta: (total: number) => PaginationMeta;
}

export function parsePagination(
  query: Record<string, unknown>,
  options: { defaultLimit?: number; maxLimit?: number; defaultSort?: string } = {},
): PaginationInput {
  const defaultLimit = options.defaultLimit ?? 20;
  const maxLimit = options.maxLimit ?? 100;
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number(query.limit) || defaultLimit));
  const skip = (page - 1) * limit;

  const sortParam = typeof query.sort === 'string' && query.sort ? query.sort : (options.defaultSort ?? '-createdAt');
  const sort: Record<string, 1 | -1> = {};
  for (const field of sortParam.split(',')) {
    const trimmed = field.trim();
    if (!trimmed) continue;
    const direction = trimmed.startsWith('-') ? -1 : 1;
    const key = trimmed.replace(/^-/, '');
    if (/^[a-zA-Z][a-zA-Z0-9_.]*$/.test(key)) sort[key] = direction;
  }
  if (!Object.keys(sort).length) sort.createdAt = -1;

  const search = typeof query.search === 'string' ? query.search.trim().slice(0, 120) : '';

  return {
    page,
    limit,
    skip,
    sort,
    search,
    meta: (total: number) => ({
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    }),
  };
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function searchFilter(search: string, fields: string[]): Record<string, unknown> {
  if (!search) return {};
  const regex = new RegExp(escapeRegex(search), 'i');
  return { $or: fields.map((field) => ({ [field]: regex })) };
}

export function dateRangeFilter(
  field: string,
  from?: string,
  to?: string,
): Record<string, unknown> {
  const range: Record<string, Date> = {};
  if (from) {
    const date = new Date(from);
    if (!Number.isNaN(date.getTime())) range.$gte = date;
  }
  if (to) {
    const date = new Date(to);
    if (!Number.isNaN(date.getTime())) {
      date.setUTCHours(23, 59, 59, 999);
      range.$lte = date;
    }
  }
  return Object.keys(range).length ? { [field]: range } : {};
}
