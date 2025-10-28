#!/usr/bin/env bun
/**
 * Cove Hub V2 - Main Entry Point
 * Self-hosted home automation hub daemon
 */

import { debug, defaultLogger } from '@cove/logger';
import { ConsoleDestination } from '@cove/logger/destinations/console';
import { RollingFileDestination } from '@cove/logger/destinations/rolling-file';
import { createRoutes } from './api/routes';
import { createWebSocketHandler } from './api/websocket';
import { HubDaemon } from './daemon';
import { env } from './env';

// Set up logging
defaultLogger.enableNamespace('*');
defaultLogger.enableNamespace('cove:*');
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

const log = debug('cove:hub');

// Initialize daemon
const daemon = new HubDaemon({
  dbPath: env.DB_PATH,
  hubId: env.HUB_ID,
});

// Create WebSocket handler
const wsHandler = createWebSocketHandler(daemon);

// Graceful shutdown handler
const shutdown = async (signal: string) => {
  log(`Received ${signal} signal, shutting down gracefully...`);

  try {
    // Close WebSocket connections
    wsHandler.closeAllConnections();

    // Stop daemon
    await daemon.stop();

    log('Hub shutdown complete');
    process.exit(0);
  } catch (error) {
    log('Error during shutdown:', error);
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
      routes: createRoutes(daemon),

      // WebSocket configuration
      websocket: {
        close: (ws, code, reason) => {
          log(`WebSocket connection closed: ${code} ${reason}`);
          wsHandler.handleWebSocketClose(ws, code, reason);
        },
        message: (_ws, message) => {
          log(`WebSocket message received: ${message}`);
          // Handle WebSocket messages here
        },
        open: (ws) => {
          log('WebSocket connection opened');
          wsHandler.handleWebSocketOpen(ws);
        },
      },
    });

    log(`Cove Hub started on http://0.0.0.0:${env.PORT}`);
    log(`Hub ID: ${daemon.getStatus().hubId}`);
    log(`Database: ${env.DB_PATH}`);
    log(`Environment: ${env.NODE_ENV}`);
  } catch (error) {
    log('Failed to start Hub:', error);
    process.exit(1);
  }
}

// Start the hub
start();
