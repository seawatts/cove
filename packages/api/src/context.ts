import { auth } from '@clerk/nextjs/server';
import { db } from '@cove/db/client';

export const createTRPCContext = async () => {
  let authResult: Awaited<ReturnType<typeof auth>> | null = null;
  try {
    authResult = await auth();
  } catch (error) {
    console.error('Error authenticating', error);
  }

  return {
    auth: authResult,
    db,
  };
};

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;
