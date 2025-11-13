import { cloudDevicesRouter } from './router/cloud-devices';
import { cloudEntitiesRouter } from './router/cloud-entities';
import { cloudTelemetryRouter } from './router/cloud-telemetry';
import { deviceRouter } from './router/device';
import { entitiesRouter } from './router/entity';
import { graphRouter } from './router/graph';
import { homeRouter } from './router/home';
import { hubRegistryRouter } from './router/hub-registry';
import { roomRouter } from './router/room';
import { userRouter } from './router/user';
import { createTRPCRouter } from './trpc';

export const appRouter = createTRPCRouter({
  cloudDevices: cloudDevicesRouter,
  cloudEntities: cloudEntitiesRouter,
  cloudTelemetry: cloudTelemetryRouter,
  device: deviceRouter,
  entity: entitiesRouter,
  graph: graphRouter,
  home: homeRouter,
  hubRegistry: hubRegistryRouter,
  room: roomRouter,
  user: userRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
