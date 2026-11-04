'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-primary text-primary-foreground shadow-sm',
        className,
      )}
    >
      <svg viewBox="0 0 64 64" className="size-full" fill="none" aria-hidden="true">
        <path
          d="M18 46 30.5 17h4L47 46h-7.2l-2.4-6.1H27.4L25 46h-7Zm11.6-12h6.6l-3.3-8.6-3.3 8.6Z"
          fill="currentColor"
        />
        <circle cx="47" cy="17" r="5" className="fill-white/60" />
      </svg>
    </span>
  );
}

export function Brand({
  collapsed = false,
  className,
}: {
  collapsed?: boolean;
  className?: string;
}) {
  const organization = useAuthStore((state) => state.activeOrganization);
  const appName = organization?.appName || process.env.NEXT_PUBLIC_APP_NAME || 'Aurora ERP';

  return (
    <Link href="/dashboard" className={cn('flex items-center gap-2.5', className)}>
      {organization?.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={organization.logoUrl}
          alt={appName}
          className="size-9 shrink-0 rounded-xl object-cover"
        />
      ) : (
        <BrandMark />
      )}
      {!collapsed && (
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold tracking-tight text-foreground">
            {appName}
          </span>
          <span className="block truncate text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {organization?.name || 'Enterprise suite'}
          </span>
        </span>
      )}
    </Link>
  );
}
