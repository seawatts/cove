'use client';

import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTRPCReact } from '@trpc/react-query';
import { useState } from 'react';
import type { HubAppRouter } from '..';

import { createHubLinks } from './config';
import { createQueryClient } from './query-client';

let hubQueryClientSingleton: QueryClient | undefined;

const getHubQueryClient = () => {
  if (typeof globalThis === 'undefined') {
    // Server: always make a new query client
    return createQueryClient();
  }

  // Browser: use singleton pattern to keep the same query client
  if (!hubQueryClientSingleton) {
    hubQueryClientSingleton = createQueryClient();
  }
  return hubQueryClientSingleton;
};

/**
 * Hub tRPC client for connecting to the self-hosted hub
 */
export const hubApi = createTRPCReact<HubAppRouter>();

/**
 * Provider for hub tRPC client
 */
export function HubTRPCProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getHubQueryClient();

  const [trpcClient] = useState(() =>
    hubApi.createClient({
      links: createHubLinks(),
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <hubApi.Provider client={trpcClient} queryClient={queryClient}>
        {children}
      </hubApi.Provider>
    </QueryClientProvider>
  );
}
