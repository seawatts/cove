import { apiKeyUsageRouter } from './router/api-key-usage';
import { apiKeysRouter } from './router/api-keys';
import { authRouter } from './router/auth';
import { automationRouter, sceneRouter } from './router/automation';
import { billingRouter } from './router/billing';
import { deviceRouter } from './router/device';
import { hubRouter } from './router/hub';
import { hueRouter } from './router/hue';
import { orgRouter } from './router/org';
import { orgMembersRouter } from './router/org-members';
import { roomRouter } from './router/room';
import { userRouter } from './router/user';
import { createTRPCRouter } from './trpc';

export const appRouter = createTRPCRouter({
  apiKeys: apiKeysRouter,
  apiKeyUsage: apiKeyUsageRouter,
  auth: authRouter,
  automation: automationRouter,
  billing: billingRouter,
  device: deviceRouter,
  hub: hubRouter,
  hue: hueRouter,
  org: orgRouter,
  orgMembers: orgMembersRouter,
  room: roomRouter,
  scene: sceneRouter,
  user: userRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
