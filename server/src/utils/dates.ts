import {
  addDays,
  endOfDay,
  endOfMonth,
  format,
  isValid,
  parseISO,
  startOfDay,
  startOfMonth,
  subMonths,
} from 'date-fns';

export { addDays, endOfDay, endOfMonth, format, parseISO, startOfDay, startOfMonth, subMonths };

export function monthKey(date: Date): string {
  return format(date, 'yyyy-MM');
}

export function monthRange(month: string): { start: Date; end: Date } | null {
  const date = parseISO(`${month}-01`);
  if (!isValid(date)) return null;
  return { start: startOfMonth(date), end: endOfMonth(date) };
}

export function lastNMonths(count: number, from = new Date()): Array<{
  key: string;
  label: string;
  start: Date;
  end: Date;
}> {
  return Array.from({ length: count }, (_, index) => {
    const date = subMonths(from, count - 1 - index);
    return {
      key: format(date, 'yyyy-MM'),
      label: format(date, 'MMM'),
      start: startOfMonth(date),
      end: endOfMonth(date),
    };
  });
}

export function fiscalYearRange(year: number, startMonth = 1): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, Math.max(0, startMonth - 1), 1));
  const end = new Date(Date.UTC(year + 1, Math.max(0, startMonth - 1), 0, 23, 59, 59, 999));
  return { start, end };
}

export function daysBetween(start: Date, end: Date): number {
  return Math.max(0, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));
}
