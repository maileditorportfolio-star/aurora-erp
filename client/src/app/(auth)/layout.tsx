'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const isReady = useAuthStore((state) => state.isReady);

  useEffect(() => {
    if (isReady && user) router.replace('/dashboard');
  }, [isReady, router, user]);

  return <div className="min-h-screen bg-background">{children}</div>;
}
