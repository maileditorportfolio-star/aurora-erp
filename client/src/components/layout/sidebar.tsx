'use client';

import { PanelLeftClose, PanelLeftOpen, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV_GROUPS } from '@/lib/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useUiStore } from '@/stores/ui-store';
import { Brand } from './brand';
import { NavLink } from './nav-item';
import { Button } from '@/components/ui/button';

export function SidebarNav({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const user = useAuthStore((state) => state.user);
  const membership = useAuthStore((state) => state.membership);
  const permissions = membership?.permissions ?? [];
  const can = (permission?: string) => {
    if (!permission) return true;
    if (user?.isSuperAdmin) return true;
    return permissions.includes('*') || permissions.includes(permission);
  };

  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4 scrollbar-thin">
      {NAV_GROUPS.map((group) => {
        const items = group.items.filter((item) =>
          item.superAdminOnly ? Boolean(user?.isSuperAdmin) : can(item.permission),
        );
        if (!items.length) return null;
        return (
          <div key={group.label} className="space-y-1">
            {!collapsed && (
              <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
                {group.label}
              </p>
            )}
            {items.map((item) => (
              <NavLink key={item.href} item={item} collapsed={collapsed} onNavigate={onNavigate} />
            ))}
          </div>
        );
      })}
    </nav>
  );
}

export function DesktopSidebar() {
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const membership = useAuthStore((state) => state.membership);

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-30 hidden border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:flex lg:flex-col',
        collapsed ? 'w-[72px]' : 'w-[248px]',
      )}
    >
      <div
        className={cn(
          'flex h-16 items-center border-b border-sidebar-border px-4',
          collapsed && 'justify-center px-0',
        )}
      >
        <Brand collapsed={collapsed} />
      </div>

      <SidebarNav collapsed={collapsed} />

      <div className="space-y-2 border-t border-sidebar-border p-3">
        {!collapsed && membership && (
          <div className="flex items-center gap-2 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 px-2.5 py-2">
            <Sparkles className="size-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold text-foreground">
                {membership.role.replace(/_/g, ' ')}
              </p>
              <p className="truncate text-[10px] text-muted-foreground">Role-based access</p>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className={cn(
            'w-full justify-start text-muted-foreground',
            collapsed && 'justify-center px-0',
          )}
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          {!collapsed && <span>Collapse</span>}
        </Button>
      </div>
    </aside>
  );
}
