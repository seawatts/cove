import { apiKeyUsageRouter } from './router/api-key-usage';
import { apiKeysRouter } from './router/api-keys';
import { authRouter } from './router/auth';
import { billingRouter } from './router/billing';
import { orgRouter } from './router/org';
import { orgMembersRouter } from './router/org-members';
import { userRouter } from './router/user';
import { createTRPCRouter } from './trpc';

export const appRouter = createTRPCRouter({
  apiKeys: apiKeysRouter,
  apiKeyUsage: apiKeyUsageRouter,
  auth: authRouter,
  billing: billingRouter,
  org: orgRouter,
  orgMembers: orgMembersRouter,
  user: userRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
