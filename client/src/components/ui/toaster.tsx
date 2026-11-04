'use client';

import { Toaster as Sonner } from 'sonner';
import { useTheme } from 'next-themes';

export function Toaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner
      theme={(resolvedTheme as 'light' | 'dark') ?? 'light'}
      position="bottom-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: 'border-border bg-card text-card-foreground shadow-lg',
          description: 'text-muted-foreground',
        },
      }}
    />
  );
}
