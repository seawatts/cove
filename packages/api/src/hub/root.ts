/**
 * Hub tRPC Root Router
 * Combines all hub routers into a single app router
 */

import { alertsRouter } from './router/alerts';
import { deviceRouter } from './router/device';
import { entityRouter } from './router/entity';
import { healthRouter } from './router/health';
import { homeRouter } from './router/home';
import { telemetryRouter } from './router/telemetry';
import { createHubRouter } from './trpc';

export const hubAppRouter = createHubRouter({
  alerts: alertsRouter,
  device: deviceRouter,
  entity: entityRouter,
  health: healthRouter,
  home: homeRouter,
  telemetry: telemetryRouter,
});

// Export type definition of API
export type HubAppRouter = typeof hubAppRouter;
