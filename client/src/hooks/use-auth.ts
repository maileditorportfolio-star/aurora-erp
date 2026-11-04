'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { hasPermission, useAuthStore } from '@/stores/auth-store';

export function useAuth() {
  const user = useAuthStore((state) => state.user);
  const activeOrganization = useAuthStore((state) => state.activeOrganization);
  const membership = useAuthStore((state) => state.membership);
  const organizations = useAuthStore((state) => state.organizations);
  const isReady = useAuthStore((state) => state.isReady);

  return {
    user,
    activeOrganization,
    membership,
    organizations,
    isReady,
    can: (permission: string) => hasPermission(membership, user, permission),
    canAny: (permissions: string[]) =>
      permissions.some((permission) => hasPermission(membership, user, permission)),
  };
}

export function useRequireAuth(redirectTo = '/login') {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const isReady = useAuthStore((state) => state.isReady);

  useEffect(() => {
    if (isReady && !user) router.replace(redirectTo);
  }, [isReady, redirectTo, router, user]);

  return { user, isReady };
}
