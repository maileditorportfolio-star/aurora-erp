'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { NAV_GROUPS } from '@/lib/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/utils';

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const user = useAuthStore((state) => state.user);
  const membership = useAuthStore((state) => state.membership);

  const pages = useMemo(() => {
    const permissions = membership?.permissions ?? [];
    return NAV_GROUPS.flatMap((group) =>
      group.items
        .filter((item) => {
          if (item.superAdminOnly) return Boolean(user?.isSuperAdmin);
          if (!item.permission) return true;
          return user?.isSuperAdmin || permissions.includes('*') || permissions.includes(item.permission);
        })
        .map((item) => ({ ...item, group: group.label })),
    );
  }, [membership, user]);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return pages.slice(0, 6);
    return pages.filter((page) => page.label.toLowerCase().includes(term)).slice(0, 8);
  }, [pages, query]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
        containerRef.current?.querySelector('input')?.focus();
      }
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative hidden w-full max-w-sm md:block">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && results[0]) {
            setOpen(false);
            setQuery('');
            router.push(results[0].href);
          }
        }}
        placeholder="Search pages and modules…"
        className="h-9 w-full rounded-lg border border-input bg-muted/40 pl-9 pr-14 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:bg-card focus:ring-2 focus:ring-ring/20"
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
        ⌘ K
      </kbd>

      {open && (
        <div className="absolute left-0 right-0 top-11 z-50 overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-xl">
          {results.length ? (
            results.map((result) => {
              const Icon = result.icon;
              return (
                <Link
                  key={result.href}
                  href={result.href}
                  onClick={() => {
                    setOpen(false);
                    setQuery('');
                  }}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors hover:bg-accent',
                  )}
                >
                  <Icon className="size-4 text-muted-foreground" />
                  <span>{result.label}</span>
                  <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
                    {result.group}
                  </span>
                </Link>
              );
            })
          ) : (
            <p className="px-3 py-4 text-sm text-muted-foreground">No matching pages</p>
          )}
        </div>
      )}
    </div>
  );
}
