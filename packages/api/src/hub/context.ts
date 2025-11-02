/**
 * Hub API Context
 * Context for the local hub tRPC API
 *
 * Imports HubDaemon from @cove/hub-core
 */

import type { HubDaemon } from '@cove/hub-core';

/**
 * Hub-specific tRPC context
 * No authentication needed for self-hosted hub
 */
export function createHubContext(opts: { daemon: HubDaemon }) {
  return {
    daemon: opts.daemon,
  };
}

export type HubContext = ReturnType<typeof createHubContext>;
