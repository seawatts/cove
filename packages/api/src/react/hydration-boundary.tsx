import 'server-only';

import {
  HydrationBoundary as ReactQueryHydrationBoundary,
  dehydrate,
} from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { api } from './server';

export async function HydrationBoundary(props: PropsWithChildren) {
  const dehydratedState = dehydrate(api.queryClient);

  return (
    <ReactQueryHydrationBoundary state={dehydratedState}>
      {props.children}
    </ReactQueryHydrationBoundary>
  );
}
