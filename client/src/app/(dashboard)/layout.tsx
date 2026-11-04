'use client';

import { useRequireAuth } from '@/hooks/use-auth';
import { useUiStore } from '@/stores/ui-store';
import { DesktopSidebar, SidebarNav } from '@/components/layout/sidebar';
import { AppHeader } from '@/components/layout/header';
import { Brand } from '@/components/layout/brand';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isReady, user } = useRequireAuth();
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const mobileNavOpen = useUiStore((state) => state.mobileNavOpen);
  const setMobileNavOpen = useUiStore((state) => state.setMobileNavOpen);

  if (!isReady || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="size-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DesktopSidebar />

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent>
          <div className="flex h-16 items-center px-4">
            <Brand />
          </div>
          <SidebarNav onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <div
        className={cn(
          'flex min-h-screen flex-col transition-[padding] duration-200',
          collapsed ? 'lg:pl-[72px]' : 'lg:pl-[248px]',
        )}
      >
        <AppHeader />
        <main className="flex-1 p-4 lg:p-6">
          <div className="mx-auto w-full max-w-[1600px] animate-in-up">{children}</div>
        </main>
        <footer className="border-t border-border/60 px-6 py-4 text-[11px] text-muted-foreground">
          © {new Date().getFullYear()} Aurora ERP. Licensed software — all rights reserved.
        </footer>
      </div>
    </div>
  );
}
