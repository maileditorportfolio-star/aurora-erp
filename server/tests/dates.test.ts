import { describe, expect, it } from 'vitest';
import { daysBetween, fiscalYearRange, lastNMonths, monthKey, monthRange } from '../src/utils/dates';

describe('dates', () => {
  it('formats month key', () => {
    expect(monthKey(new Date('2026-03-15T00:00:00Z'))).toBe('2026-03');
  });

  it('builds month range', () => {
    const range = monthRange('2026-02');
    expect(range).not.toBeNull();
    expect(range?.start.getMonth()).toBe(1);
    expect(range?.end.getDate()).toBe(28);
  });

  it('returns null for invalid month', () => {
    expect(monthRange('not-a-month')).toBeNull();
  });

  it('builds last N months', () => {
    const months = lastNMonths(3, new Date('2026-05-10T00:00:00Z'));
    expect(months).toHaveLength(3);
    expect(months.map((item) => item.key)).toEqual(['2026-03', '2026-04', '2026-05']);
  });

  it('builds fiscal year range', () => {
    const range = fiscalYearRange(2026, 4);
    expect(range.start.getUTCMonth()).toBe(3);
    expect(range.end.getUTCFullYear()).toBe(2027);
  });

  it('calculates days between', () => {
    const start = new Date('2026-01-01T00:00:00Z');
    const end = new Date('2026-01-10T00:00:00Z');
    expect(daysBetween(start, end)).toBe(9);
    expect(daysBetween(end, start)).toBe(0);
  });
});