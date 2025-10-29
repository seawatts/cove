/**
 * Hub tRPC initialization
 * No authentication middleware - self-hosted hub
 */

import { debug } from '@cove/logger';
import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';
import type { Context } from './context';

const log = debug('cove:hub-v2:trpc');

/**
 * Initialize tRPC instance with hub context
 */
const t = initTRPC.context<Context>().create({
  errorFormatter: ({ shape, error }) => ({
    ...shape,
    data: {
      ...shape.data,
      zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
    },
  }),
  transformer: superjson,
});

/**
 * Create a server-side caller factory
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * Timing middleware for procedure execution
 */
const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();
  const result = await next();
  const end = Date.now();
  log(`[TRPC] ${path} took ${end - start}ms to execute`);
  return result;
});

/**
 * Public (unauthenticated) procedure
 * All hub procedures are public since it's self-hosted
 */
export const publicProcedure = t.procedure.use(timingMiddleware);

/**
 * Router creator
 */
export const createTRPCRouter = t.router;
