/**
 * tRPC Fetch Handler for Bun.serve()
 * Handles tRPC requests at /trpc/* endpoint
 */

import { createHubContext, hubAppRouter } from '@cove/api/hub';
import type { HubDaemon } from '@cove/hub-core';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';

// CORS headers for web app access
const corsHeaders = {
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

/**
 * Create tRPC fetch handler for Bun.serve()
 */
export function createTRPCHandler(daemon: HubDaemon) {
  return async (req: Request): Promise<Response> => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders,
        status: 204,
      });
    }

    const response = await fetchRequestHandler({
      createContext: () => createHubContext({ daemon }),
      endpoint: '/trpc',
      req,
      router: hubAppRouter,
    });

    // Add CORS headers to all responses
    const headers = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });

    return new Response(response.body, {
      headers,
      status: response.status,
      statusText: response.statusText,
    });
  };
}
