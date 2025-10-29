import { httpBatchLink, loggerLink } from '@trpc/client';
import superjson from 'superjson';
import { env } from '~/env.client';

/**
 * Get hub URL from environment
 */
export const getHubUrl = () => {
  return env.NEXT_PUBLIC_HUB_URL || 'http://localhost:3200';
};

/**
 * Create default links for hub tRPC client
 */
export const createHubLinks = () => [
  loggerLink({
    enabled: (op) =>
      env.NODE_ENV === 'development' ||
      (op.direction === 'down' && op.result instanceof Error),
  }),
  httpBatchLink({
    transformer: superjson,
    url: `${getHubUrl()}/trpc`,
  }),
];
