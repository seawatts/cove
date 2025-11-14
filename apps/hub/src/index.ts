#!/usr/bin/env bun

/**
 * Cove Hub V2 - Main Entry Point
 * Self-hosted home automation hub daemon
 */

import { HubDaemon } from '@cove/hub-core';
import { debug, defaultLogger, error, info } from '@cove/logger';
import { ConsoleDestination } from '@cove/logger/destinations/console';
import { RollingFileDestination } from '@cove/logger/destinations/rolling-file';
import { createTRPCHandler } from './api/handler';
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

  // Create tRPC handler
  const trpcHandler = createTRPCHandler(daemon);

  // Graceful shutdown handler
  const shutdown = async (signal: string, exitCode = 0) => {
    logInfo(`Received ${signal} signal, shutting down gracefully...`);

    try {
      // Stop daemon
      await daemon.stop();

      logInfo('Hub shutdown complete');
      process.exit(exitCode);
    } catch (err) {
      logError('Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle upgrade restart (exit code 42)
  // This allows a process manager or systemd to detect and restart the hub
  process.on('exit', (code) => {
    if (code === 42) {
      logInfo('Hub upgrade detected, exiting for restart...');
    }
  });

  // Start the hub
  async function start() {
    try {
      // Initialize and start daemon
      await daemon.initialize();
      await daemon.start();

      // Start the HTTP server
      Bun.serve({
        fetch: async (req: Request) => {
          const url = new URL(req.url);

          // Handle tRPC requests
          if (url.pathname.startsWith('/trpc')) {
            return await trpcHandler(req);
          }

          // Health check endpoint
          if (url.pathname === '/health') {
            return Response.json({
              status: 'ok',
              ...daemon.getStatus(),
            });
          }

          // Default 404
          return new Response('Not Found', { status: 404 });
        },
        hostname: '0.0.0.0',
        port: env.PORT,
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
