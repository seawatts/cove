/**
 * Hub API Module
 * Local hub tRPC API for self-hosted home automation
 *
 * This is kept separate from the main API to isolate hub-specific functionality
 */

// Export context creator
export { createHubContext, type HubContext } from './context';
// Export root router and type
export { type HubAppRouter, hubAppRouter } from './root';
// Export individual routers (for testing/composition)
export { alertsRouter } from './router/alerts';
export { deviceRouter } from './router/device';
export { entityRouter } from './router/entity';
export { healthRouter } from './router/health';
export { homeRouter } from './router/home';
export { telemetryRouter } from './router/telemetry';
// Export tRPC utilities
export { createCallerFactory, createHubRouter, publicProcedure } from './trpc';
