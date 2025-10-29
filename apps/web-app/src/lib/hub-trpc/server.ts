/**
 * Server-side Hub tRPC caller
 * For use in Next.js Server Components and Server Actions
 */

import type { AppRouter } from '@cove/hub-v2';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { cache } from 'react';
import superjson from 'superjson';

/**
 * Get hub URL from environment (server-side safe)
 */
function getHubUrl(): string {
  return process.env.NEXT_PUBLIC_HUB_URL || 'http://localhost:3200';
}

/**
 * Create a server-side tRPC client for the hub API
 * This makes HTTP requests to the hub service
 */
export const getHubApi = cache(() => {
  const hubUrl = getHubUrl();

  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        transformer: superjson,
        url: `${hubUrl}/trpc`,
      }),
    ],
  });
});
