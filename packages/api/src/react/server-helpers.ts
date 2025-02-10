import type {
  Client,
  ProceduresDef,
  _inferProcedureHandlerInput,
  inferQueries,
  inferQueryResult,
} from '@rspc/client'
import type {
  DehydrateOptions,
  DehydratedState,
  QueryClient,
} from '@tanstack/react-query'
import { dehydrate } from '@tanstack/react-query'
import SuperJSON from 'superjson'
import { createQueryClient } from './query-client'

type CreateServerSideHelpersOptions<T extends ProceduresDef> = {
  client: Client<T>
  queryClient?: QueryClient
}

type QueryKeyAndInput<
  T extends ProceduresDef,
  K extends inferQueries<T>['key'],
> = [key: K, ...input: _inferProcedureHandlerInput<T, 'queries', K>]

/**
 * Create functions you can use for server-side rendering / static generation
 */
export function createServerSideHelpers<T extends ProceduresDef>(
  opts: CreateServerSideHelpersOptions<T>,
) {
  const queryClient = opts.queryClient ?? createQueryClient()
  const { client } = opts

  const resolvedOpts = {
    serialize: (obj: unknown) => {
      const serialized = SuperJSON.serialize(obj)
      const dehydratedState = {
        mutations: [],
        queries: Array.isArray(serialized.json) ? serialized.json : [],
      }
      return dehydratedState as unknown as DehydratedState
    },
    query: async <K extends inferQueries<T>['key']>(
      queryKey: QueryKeyAndInput<T, K>,
    ) => client.query(queryKey),
  }

  function _dehydrate(
    opts: DehydrateOptions = {
      shouldDehydrateQuery() {
        return true
      },
    },
  ): DehydratedState {
    const before = dehydrate(queryClient, opts)
    return resolvedOpts.serialize(before)
  }

  type CreateSSGHelpers = {
    queryClient: QueryClient
    dehydrate: (opts?: DehydrateOptions) => DehydratedState
    fetch: <K extends inferQueries<T>['key']>(
      queryKey: QueryKeyAndInput<T, K>,
    ) => Promise<inferQueryResult<T, K>>
    prefetch: <K extends inferQueries<T>['key']>(
      queryKey: QueryKeyAndInput<T, K>,
    ) => Promise<void>
  }

  const helpers: CreateSSGHelpers = {
    queryClient,
    dehydrate: _dehydrate,
    fetch: async (queryKey) => {
      const queryFn = () => resolvedOpts.query(queryKey)
      return queryClient.fetchQuery({
        queryKey,
        queryFn,
      })
    },
    prefetch: async (queryKey) => {
      const queryFn = () => resolvedOpts.query(queryKey)
      return queryClient.prefetchQuery({
        queryKey,
        queryFn,
      })
    },
  }

  return helpers
}
