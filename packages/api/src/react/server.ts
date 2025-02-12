import 'server-only';

import { createClient } from '@rspc/client';
import { FetchTransport } from '@rspc/client';
import { cache } from 'react';
import { createQueryClient } from './query-client';
import type { Procedures } from './react';
import { createServerSideHelpers } from './server-helpers';

export const getQueryClient = cache(createQueryClient);
const client = createClient<Procedures>({
  // Refer to the integration your using for the correct transport.
  onError: (error) => {
    console.error(error);
  },
  // TODO: Update this with the correct URL. Pull in from env.
  transport: new FetchTransport('http://localhost:4000/rspc'),
});

export const api = createServerSideHelpers({
  client,
  queryClient: getQueryClient(),
});
