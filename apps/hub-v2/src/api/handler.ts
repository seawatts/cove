/**
 * tRPC Fetch Handler for Bun.serve()
 * Handles tRPC requests at /trpc/* endpoint
 */

import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import type { HubDaemon } from '../daemon';
import { createTRPCContext } from './context';
import { appRouter } from './root';

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
      createContext: () => createTRPCContext({ daemon }),
      endpoint: '/trpc',
      req,
      router: appRouter,
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
