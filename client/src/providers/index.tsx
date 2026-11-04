'use client';

import { useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { api, refreshAccessToken } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import type { MePayload } from '@/lib/types';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          const status = (error as { status?: number })?.status;
          if (status && status >= 400 && status < 500) return false;
          return failureCount < 2;
        },
      },
    },
  });
}

function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const hydrated = useRef(false);
  const [ready, setReady] = useState(false);
  const setSession = useAuthStore((state) => state.setSession);
  const clear = useAuthStore((state) => state.clear);
  const setReadyState = useAuthStore((state) => state.setReady);

  useEffect(() => {
    async function bootstrap() {
      const store = useAuthStore.persist;
      if (!hydrated.current) {
        await store.rehydrate();
        hydrated.current = true;
      }

      const session = await refreshAccessToken();
      if (session) {
        setSession(session);
        try {
          const me = await api.get<MePayload>('/auth/me');
          setSession(me);
        } catch {
          // The session payload is still usable; /auth/me can fail transiently.
        }
      } else {
        clear();
      }
      setReadyState(true);
      setReady(true);
    }
    void bootstrap();

    const onUnauthorized = () => {
      clear();
      setReadyState(true);
    };
    window.addEventListener('aurora:unauthorized', onUnauthorized);
    return () => window.removeEventListener('aurora:unauthorized', onUnauthorized);
  }, [clear, setSession, setReadyState]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="size-9 animate-spin rounded-full border-2 border-muted border-t-primary" />
          <p className="text-sm text-muted-foreground">Starting Aurora…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={200}>
          <AuthBootstrap>{children}</AuthBootstrap>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
