import { TRPCReactProvider } from '@acme/api/client';
import { cn } from '@acme/ui/lib/utils';
import { SidebarProvider } from '@acme/ui/sidebar';
import { ThemeProvider } from '@acme/ui/theme';
import { Toaster } from '@acme/ui/toast';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Outlet, createRootRoute } from '@tanstack/react-router';
import '@acme/ui/globals.css';

import React, { Suspense } from 'react';
import { AppSidebar } from '~/components/app-sidebar';
import { ErrorBoundary } from '~/components/error-boundary';

const TanStackRouterDevtools =
  process.env.NODE_ENV === 'production'
    ? () => null
    : React.lazy(() =>
        import('@tanstack/router-devtools').then((res) => ({
          default: res.TanStackRouterDevtools,
        })),
      );

export const Route = createRootRoute({
  component: () => (
    <ErrorBoundary>
      <div
        className={cn(
          'bg-background text-foreground relative min-h-screen antialiased',
          'font-sans',
        )}
      >
        <TRPCReactProvider>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
            <SidebarProvider defaultOpen={false}>
              <AppSidebar />
              <main className="flex-1">
                <Outlet />
                <Suspense>
                  <TanStackRouterDevtools />
                </Suspense>
                <ReactQueryDevtools />
              </main>
            </SidebarProvider>
            <Toaster />
          </ThemeProvider>
        </TRPCReactProvider>
      </div>
    </ErrorBoundary>
  ),
});
