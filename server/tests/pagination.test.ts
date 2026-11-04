import { describe, expect, it } from 'vitest';
import { escapeRegex, parsePagination, searchFilter } from '../src/utils/pagination';

describe('parsePagination', () => {
  it('applies defaults and caps limit', () => {
    const result = parsePagination({ page: '2', limit: '500' }, { defaultLimit: 10, maxLimit: 25 });
    expect(result.page).toBe(2);
    expect(result.limit).toBe(25);
    expect(result.skip).toBe(25);
  });

  it('parses sort and search', () => {
    const result = parsePagination({ sort: '-createdAt,name', search: 'foo' });
    expect(result.sort).toEqual({ createdAt: -1, name: 1 });
    expect(result.search).toBe('foo');
  });

  it('falls back to default sort when empty', () => {
    const result = parsePagination({}, { defaultSort: '-updatedAt' });
    expect(result.sort).toEqual({ updatedAt: -1 });
  });
});

describe('searchFilter', () => {
  it('builds case-insensitive regex OR filter', () => {
    const filter = searchFilter('abc', ['name', 'email']) as { $or: Array<Record<string, RegExp>> };
    expect(filter.$or).toHaveLength(2);
    expect(filter.$or[0]?.name.flags).toContain('i');
  });

  it('returns empty object for empty search', () => {
    expect(searchFilter('', ['name'])).toEqual({});
  });
});

describe('escapeRegex', () => {
  it('escapes special characters', () => {
    expect(escapeRegex('a.b*c')).toBe('a\\.b\\*c');
  });
});