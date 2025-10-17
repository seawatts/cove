import { ReactScan } from '@cove/ui/custom/react-scan';
import { ThemeProvider } from '@cove/ui/custom/theme';
import { cn } from '@cove/ui/lib/utils';
import { Toaster } from '@cove/ui/sonner';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import type { Metadata, Viewport } from 'next';
import { NuqsAdapter } from 'nuqs/adapters/next/app';

import '@cove/ui/globals.css';

import { ClerkProvider } from '@clerk/nextjs';
import { AnalyticsProviders } from '@cove/analytics/providers';
import { TRPCReactProvider } from '@cove/api/react';
import { Suspense } from 'react';
import { env } from '~/env.server';

export const metadata: Metadata = {
  description: 'Seawatts is a tool for developers to manage their webhooks',
  metadataBase: new URL(
    env.VERCEL_ENV === 'production'
      ? 'https://seawatts.sh'
      : 'http://localhost:3000',
  ),
  openGraph: {
    description: 'Seawatts is a tool for developers to manage their webhooks',
    siteName: 'Seawatts',
    title: 'Seawatts',
    url: 'https://seawatts.sh',
  },
  title: 'Seawatts',
  twitter: {
    card: 'summary_large_image',
    creator: '@seawatts',
    site: '@seawatts',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { color: 'white', media: '(prefers-color-scheme: light)' },
    { color: 'black', media: '(prefers-color-scheme: dark)' },
  ],
};

const isDevelopment = process.env.NODE_ENV === 'development';

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          'bg-background text-foreground relative min-h-screen font-sans antialiased',
          GeistSans.variable,
          GeistMono.variable,
        )}
      >
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          {isDevelopment && <ReactScan />}
          <NuqsAdapter>
            <TRPCReactProvider>
              <Suspense>
                <ClerkProvider>
                  <AnalyticsProviders identifyUser>
                    {props.children}
                    <Toaster />
                  </AnalyticsProviders>
                </ClerkProvider>
              </Suspense>
            </TRPCReactProvider>
          </NuqsAdapter>
        </ThemeProvider>
      </body>
    </html>
  );
}
