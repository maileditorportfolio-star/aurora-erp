'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Membership, Organization, SessionPayload, User } from '@/lib/types';

interface AuthState {
  user: User | null;
  activeOrganization: Organization | null;
  membership: Membership | null;
  organizations: Organization[];
  isReady: boolean;
  setSession: (session: SessionPayload | { user: User; activeOrganization: Organization | null; membership: Membership | null; organizations: Organization[] }) => void;
  setReady: (ready: boolean) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      activeOrganization: null,
      membership: null,
      organizations: [],
      isReady: false,
      setSession: (session) =>
        set({
          user: session.user,
          activeOrganization: session.activeOrganization,
          membership: session.membership,
          organizations: session.organizations ?? [],
        }),
      setReady: (isReady) => set({ isReady }),
      clear: () =>
        set({
          user: null,
          activeOrganization: null,
          membership: null,
          organizations: [],
          isReady: true,
        }),
    }),
    {
      name: 'aurora-auth',
      skipHydration: true,
      partialize: (state) => ({
        user: state.user,
        activeOrganization: state.activeOrganization,
        membership: state.membership,
        organizations: state.organizations,
      }),
    },
  ),
);

export function hasPermission(
  membership: Membership | null | undefined,
  user: User | null | undefined,
  permission: string,
): boolean {
  if (user?.isSuperAdmin) return true;
  if (!membership) return false;
  if (membership.permissions?.includes('*')) return true;
  return membership.permissions?.includes(permission) ?? false;
}

export function hasAnyPermission(
  membership: Membership | null | undefined,
  user: User | null | undefined,
  permissions: string[],
): boolean {
  return permissions.some((permission) => hasPermission(membership, user, permission));
}
