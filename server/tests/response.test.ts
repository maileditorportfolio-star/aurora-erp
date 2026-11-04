import { describe, expect, it } from 'vitest';
import { parsePagination } from '../src/utils/pagination';
import { sendSuccess } from '../src/utils/response';

describe('response helpers', () => {
  it('parsePagination builds meta', () => {
    const pagination = parsePagination({ page: '1', limit: '2' });
    const meta = pagination.meta(5);
    expect(meta.pages).toBe(3);
    expect(meta.hasNext).toBe(true);
    expect(meta.hasPrev).toBe(false);
  });
});