import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name?: string | null): string {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function truncate(value: string, length = 60): string {
  if (value.length <= length) return value;
  return `${value.slice(0, length - 1)}…`;
}

export function getPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[key];
  }, source);
}

export function setPath(target: Record<string, unknown>, path: string, value: unknown) {
  const keys = path.split('.');
  let current: Record<string, unknown> = target;
  for (const key of keys.slice(0, -1)) {
    const next = current[key];
    if (!next || typeof next !== 'object') current[key] = {};
    current = current[key] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]!] = value;
  return target;
}

export function refName(ref: unknown): string {
  if (!ref) return '—';
  if (typeof ref === 'string') return ref;
  if (typeof ref !== 'object') return String(ref);
  const record = ref as Record<string, unknown>;
  return String(record.name ?? record.company ?? record.number ?? record.title ?? '—');
}

export function refId(ref: unknown): string | undefined {
  if (!ref) return undefined;
  if (typeof ref === 'string') return ref;
  if (typeof ref !== 'object') return undefined;
  const record = ref as Record<string, unknown>;
  const value = record.id ?? record._id;
  return value === undefined || value === null ? undefined : String(value);
}

/** Display name for populated user or employee references. */
export function personName(ref: unknown): string {
  if (!ref) return '—';
  if (typeof ref === 'string') return ref;
  if (typeof ref !== 'object') return String(ref);
  const record = ref as Record<string, unknown>;
  const full = [record.firstName, record.lastName].filter(Boolean).join(' ').trim();
  return full || String(record.name ?? record.fullName ?? record.email ?? '—');
}
