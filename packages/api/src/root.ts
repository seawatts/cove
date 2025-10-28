import { deviceRouter } from './router/device';
import { entitiesRouter } from './router/entity';
import { graphRouter } from './router/graph';
import { homeRouter } from './router/home';
import { roomRouter } from './router/room';
import { userRouter } from './router/user';
import { createTRPCRouter } from './trpc';

export const appRouter = createTRPCRouter({
  device: deviceRouter,
  entity: entitiesRouter,
  graph: graphRouter,
  home: homeRouter,
  room: roomRouter,
  user: userRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
