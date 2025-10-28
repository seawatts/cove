#!/usr/bin/env bun
/**
 * Cove Hub - Main Entry Point
 * Self-hosted home automation hub daemon
 */

import { debug, defaultLogger } from '@cove/logger';
import { ConsoleDestination } from '@cove/logger/destinations/console';
import { RollingFileDestination } from '@cove/logger/destinations/rolling-file';
import { createRoutes } from './api/routes';
import { HubDaemon } from './daemon';
import { env } from './env';
import { resetStartTime } from './health';

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
const daemon = new HubDaemon();

// Graceful shutdown handler
const shutdown = async (signal: string) => {
  log(`Received ${signal} signal, shutting down gracefully...`);
  await daemon.stop();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start the hub API server using Bun.serve with Bun 1.3 routing
Bun.serve({
  hostname: env.HOST || '0.0.0.0',
  port: env.PORT || 3100,

  // Define routes using the extracted routes module
  routes: createRoutes(daemon),

  // WebSocket handler for real-time updates
  websocket: {
    close(_ws, code, reason) {
      log(`WebSocket connection closed: ${code} ${reason}`);
    },
    message(_ws, message) {
      log(`WebSocket message received: ${message}`);
      // TODO: Handle device commands from clients
    },
    open(_ws) {
      log('WebSocket connection opened');
      // TODO: Subscribe client to device updates
    },
  },
});

// Start the daemon
resetStartTime();
await daemon.start();

log(
  `Cove Hub v${env.HUB_VERSION || '0.1.0'} started on http://${env.HOST || '0.0.0.0'}:${env.PORT || 3100}`,
);
log(`Hub ID: ${env.HUB_ID || 'not set'}`);
log(`Discovery: ${env.DISCOVERY_ENABLED ? 'enabled' : 'disabled'}`);
log(`Environment: ${env.NODE_ENV || 'development'}`);
