const DEFAULT_CURRENCY = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY || 'USD';

export function formatCurrency(
  value: number | string | null | undefined,
  currency = DEFAULT_CURRENCY,
  options: Intl.NumberFormatOptions = {},
): string {
  const numeric = typeof value === 'string' ? Number(value) : (value ?? 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  }).format(Number.isFinite(numeric) ? numeric : 0);
}

export function formatCompactCurrency(value: number | null | undefined, currency = DEFAULT_CURRENCY) {
  const numeric = value ?? 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: Math.abs(numeric) >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: Math.abs(numeric) >= 10_000 ? 1 : 2,
  }).format(numeric);
}

export function formatNumber(value: number | string | null | undefined): string {
  const numeric = typeof value === 'string' ? Number(value) : (value ?? 0);
  return new Intl.NumberFormat('en-US').format(Number.isFinite(numeric) ? numeric : 0);
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  const numeric = value ?? 0;
  return `${numeric > 0 ? '+' : ''}${numeric.toFixed(digits)}%`;
}

export function formatDate(
  value: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' },
): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', options).format(date);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  return formatDate(value, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatRelative(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
}

export function toDateInput(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export function humanize(value: string | null | undefined): string {
  if (!value) return '—';
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}
