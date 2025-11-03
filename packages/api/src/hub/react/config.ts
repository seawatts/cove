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
       * Maximum number of requests to batch in a single HTTP call
       * Default is unlimited, but we set a reasonable limit to prevent
       * extremely large payloads. Adjust if needed.
       */
      maxBatchSize: 50,

      /**
       * Maximum time to wait (in ms) before sending a batch
       * This allows more requests to be batched together
       * Default is 0 (immediate), but 10ms helps batch more queries
       */
      maxURLLength: 2083, // Max URL length for GET requests

      transformer: superjson,
      url: `${getHubUrl()}/trpc`,
    }),
  ];
}
