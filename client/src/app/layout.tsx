import type { Metadata, Viewport } from 'next';
import { Providers } from '@/providers';
import './globals.css';

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Aurora ERP';
const TAGLINE =
  process.env.NEXT_PUBLIC_APP_TAGLINE || 'Run your entire business from one place';

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — ${TAGLINE}`,
    template: `%s · ${APP_NAME}`,
  },
  description:
    'Aurora ERP is a modern, multi-tenant enterprise resource planning platform for sales, inventory, purchasing, finance and people operations.',
  applicationName: APP_NAME,
  robots: { index: false, follow: false },
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#111318' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
