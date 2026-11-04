'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { humanize } from '@/lib/formatters';
import { NAV_GROUPS } from '@/lib/navigation';

const LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  sales: 'Sales',
  inventory: 'Inventory',
  purchases: 'Purchasing',
  finance: 'Finance',
  hr: 'People',
  settings: 'Settings',
  organization: 'Organization',
  profile: 'Profile',
  audit: 'Audit log',
  team: 'Team & roles',
  notifications: 'Notifications',
  admin: 'Admin console',
};

const HREF_LABELS = new Map(
  NAV_GROUPS.flatMap((group) => group.items.map((item) => [item.href, item.label] as const)),
);

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  return (
    <nav className="hidden items-center gap-1.5 text-sm text-muted-foreground md:flex">
      <Link href="/dashboard" className="transition-colors hover:text-foreground">
        <Home className="size-4" />
        <span className="sr-only">Home</span>
      </Link>
      {segments.map((segment, index) => {
        const href = `/${segments.slice(0, index + 1).join('/')}`;
        const isLast = index === segments.length - 1;
        const label = HREF_LABELS.get(href) ?? LABELS[segment] ?? humanize(segment);
        return (
          <span key={href} className="flex items-center gap-1.5">
            <ChevronRight className="size-3.5 text-muted-foreground/60" />
            {isLast ? (
              <span className="font-medium text-foreground">{label}</span>
            ) : (
              <Link href={href} className="transition-colors hover:text-foreground">
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
