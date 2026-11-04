'use client';

import { Menu } from 'lucide-react';
import { Breadcrumbs } from './breadcrumbs';
import { GlobalSearch } from './global-search';
import { NotificationsMenu } from './notifications-menu';
import { OrgSwitcher } from './org-switcher';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';
import { Button } from '@/components/ui/button';
import { useUiStore } from '@/stores/ui-store';

export function AppHeader() {
  const setMobileNavOpen = useUiStore((state) => state.setMobileNavOpen);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border/80 bg-background/85 px-4 backdrop-blur-md lg:px-6">
      <Button
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        onClick={() => setMobileNavOpen(true)}
        aria-label="Open navigation"
      >
        <Menu />
      </Button>

      <Breadcrumbs />
      <div className="ml-auto flex items-center gap-1.5">
        <GlobalSearch />
        <OrgSwitcher />
        <ThemeToggle />
        <NotificationsMenu />
        <UserMenu />
      </div>
    </header>
  );
}
