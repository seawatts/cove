/**
 * Server-side Hub tRPC caller
 * For use in Next.js Server Components and Server Actions
 */

import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { cache } from 'react';
import superjson from 'superjson';
import type { HubAppRouter } from '..';

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

  return createTRPCClient<HubAppRouter>({
    links: [
      httpBatchLink({
        transformer: superjson,
        url: `${hubUrl}/trpc`,
      }),
    ],
  });
});
