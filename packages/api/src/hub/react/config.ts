import { httpBatchLink, loggerLink } from '@trpc/client';
import superjson from 'superjson';

/**
 * Get hub URL from environment
 */
export function getHubUrl(): string {
  if (typeof window !== 'undefined') {
    // Client-side: check both window and process
    return process.env.NEXT_PUBLIC_HUB_URL || 'http://localhost:3200';
  }
  // Server-side
  return process.env.NEXT_PUBLIC_HUB_URL || 'http://localhost:3200';
}

/**
 * Create default links for hub tRPC client
 */
export function createHubLinks() {
  return [
    loggerLink({
      enabled: (op) =>
        process.env.NODE_ENV === 'development' ||
        (op.direction === 'down' && op.result instanceof Error),
    }),
    httpBatchLink({
      /**
       * Maximum URL length for GET requests
       * Longer URLs will be sent via POST instead
       */
      maxURLLength: 2083,

      transformer: superjson,
      url: `${getHubUrl()}/trpc`,
    }),
  ];
}
