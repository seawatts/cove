'use client'

import type { QueryClient } from '@tanstack/react-query'
import { QueryClientProvider } from '@tanstack/react-query'
import {} from '@trpc/client'
import { type ReactElement, useState } from 'react'

import { FetchTransport, createClient } from '@rspc/client'
import { createReactQueryHooks } from '@rspc/react'
import { env } from '../env.client'
import { createQueryClient } from './query-client'

let clientQueryClientSingleton: QueryClient | undefined = undefined

const getQueryClient = () => {
  if (typeof globalThis === 'undefined') {
    // Server: always make a new query client
    return createQueryClient()
  }

  // Browser: use singleton pattern to keep the same query client
  if (!clientQueryClientSingleton) {
    clientQueryClientSingleton = createQueryClient()
  }
  return clientQueryClientSingleton
}

// export const api = createTRPCReact<AppRouter>()
export const api = createReactQueryHooks<Procedures>()

type Procedures = {
  mutations: {
    key: 'hello'
    input: {
      name: string
    }
    result: string
  }
  subscriptions: {
    key: 'hello'
    input: {
      name: string
    }
    result: string
  }
  queries: {
    key: 'hello'
    input: {
      name: string
    }
    result: string
  }
}
export function TRPCReactProvider(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient()

  const [rspcClient] = useState(() =>
    createClient<Procedures>({
      // Refer to the integration your using for the correct transport.
      onError: (error) => {
        console.error(error)
      },
      // TODO: Update this with the correct URL. Pull in from env.
      transport: new FetchTransport('http://localhost:4000/rspc'),
    }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <api.Provider client={rspcClient} queryClient={queryClient}>
        {props.children as ReactElement}
      </api.Provider>
    </QueryClientProvider>
  )
}

const getBaseUrl = () => {
  if (typeof globalThis !== 'undefined' && globalThis.location)
    return globalThis.location.origin
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`

  return `http://localhost:${process.env.PORT ?? 3000}`
}
