import { QueryClient } from '@tanstack/react-query';

/**
 * Create a query client for hub tRPC
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: 1,
        // Hub queries can be stale longer since it's local
        staleTime: 30 * 1000, // 30 seconds
      },
    },
  });
}
