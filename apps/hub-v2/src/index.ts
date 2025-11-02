#!/usr/bin/env bun
/**
 * Cove Hub V2 - Main Entry Point
 * Self-hosted home automation hub daemon
 */

import { debug, defaultLogger, error, info } from '@cove/logger';
import { ConsoleDestination } from '@cove/logger/destinations/console';
import { RollingFileDestination } from '@cove/logger/destinations/rolling-file';
import { createTRPCHandler } from './api/handler';
import { createRoutes } from './api/routes';
import { createWebSocketHandler } from './api/websocket';
import { HubDaemon } from './daemon';
import { env } from './env';

try {
  // Set up logging based on environment configuration
  // Note: The logger package reads LOG_LEVEL and DEBUG env vars automatically,
  // but we still configure namespaces here for explicit control
  for (const namespace of env.DEBUG.split(',')) {
    defaultLogger.enableNamespace(namespace.trim());
  }
  defaultLogger.addDestination(new ConsoleDestination());

  // Add file-based logging
  defaultLogger.addDestination(
    new RollingFileDestination({
      createDirectory: true,
      filepath: './logs/hub.log',
      maxFiles: 5,
      maxSize: 10 * 1024 * 1024, // 10MB
    }),
  );

  const logDebug = debug('cove:hub');
  const logInfo = info('cove:hub');
  const logError = error('cove:hub');

  // Initialize daemon
  const daemon = new HubDaemon({
    dbPath: env.DB_PATH,
    hubId: env.HUB_ID,
  });

  // Create WebSocket handler
  const wsHandler = createWebSocketHandler(daemon);

  // Create tRPC handler
  const trpcHandler = createTRPCHandler(daemon);

  // Graceful shutdown handler
  const shutdown = async (signal: string) => {
    logInfo(`Received ${signal} signal, shutting down gracefully...`);

    try {
      // Close WebSocket connections
      wsHandler.closeAllConnections();

      // Stop daemon
      await daemon.stop();

      logInfo('Hub shutdown complete');
      process.exit(0);
    } catch (err) {
      logError('Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Start the hub
  async function start() {
    try {
      // Initialize and start daemon
      await daemon.initialize();
      await daemon.start();

      // Start the HTTP server with WebSocket support
      Bun.serve({
        hostname: '0.0.0.0',
        port: env.PORT,

        // Define routes - Bun handles the routing automatically
        routes: {
          ...createRoutes(daemon),
          // tRPC endpoint
          '/trpc/*': async (req: Request) => {
            return await trpcHandler(req);
          },
        },

        // WebSocket configuration
        websocket: {
          close: (ws, code, reason) => {
            logDebug(`WebSocket connection closed: ${code} ${reason}`);
            wsHandler.handleWebSocketClose(ws, code, reason);
          },
          message: (_ws, message) => {
            logDebug(`WebSocket message received: ${message}`);
            // Handle WebSocket messages here
          },
          open: (ws) => {
            logDebug('WebSocket connection opened');
            wsHandler.handleWebSocketOpen(ws);
          },
        },
      });

      logInfo(`Cove Hub started on http://0.0.0.0:${env.PORT}`);
      logInfo(`Hub ID: ${daemon.getStatus().hubId}`);
      logDebug(`Database: ${env.DB_PATH}`);
      logDebug(`Environment: ${env.NODE_ENV}`);
      logInfo(`tRPC endpoint: http://0.0.0.0:${env.PORT}/trpc`);
    } catch (err) {
      logError('Failed to start Hub:', err);
      process.exit(1);
    }
  }

  // Start the hub
  start();
} catch (err) {
  console.error('❌ Fatal error:', err);
  process.exit(1);
}
