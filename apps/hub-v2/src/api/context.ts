import type { HubDaemon } from '../daemon';

/**
 * Hub-specific tRPC context
 * No authentication needed for self-hosted hub
 */
export function createTRPCContext(opts: { daemon: HubDaemon }) {
  return {
    daemon: opts.daemon,
  };
}

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;
