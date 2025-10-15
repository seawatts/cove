'use server';

import { auth, currentUser } from '@clerk/nextjs/server';
import { db } from '@cove/db/client';
import { Orgs } from '@cove/db/schema';
import { eq } from 'drizzle-orm';
import { createSafeActionClient } from 'next-safe-action';
import { z } from 'zod';

// Create the action client
const action = createSafeActionClient();

export const upsertOrgAction = action
  .inputSchema(
    z.object({
      clerkOrgId: z.string().optional(),
      name: z.string().optional(),
      webhookId: z.string().optional(),
    }),
  )
  .action(async ({ parsedInput }) => {
    const { clerkOrgId, webhookId } = parsedInput;
    const user = await auth();

    if (!user.userId) {
      throw new Error('User not found');
    }

    const clerkUser = await currentUser();
    if (!clerkUser) {
      throw new Error('User details not found');
    }

    console.log('upsertOrgAction called with:', {
      clerkOrgId,
      userId: user.userId,
      webhookId,
    });

    // If no clerkOrgId is provided (creating new org), check if user already has an organization
    if (!clerkOrgId) {
      const existingOrg = await db.query.Orgs.findFirst({
        where: eq(Orgs.createdByUserId, user.userId),
      });

      console.log('Existing org found:', existingOrg);

      if (existingOrg) {
        console.log('Returning existing org result:', existingOrg);

        return {
          apiKey: undefined,
          id: existingOrg.id,
          name: existingOrg.name,
          stripeCustomerId: existingOrg.stripeCustomerId,
        };
      }
    }

    console.log('Creating new organization...');

    // Note: Organization creation should be handled through the tRPC API
    // This action is mainly for checking existing orgs
    throw new Error(
      'New organization creation should use the tRPC org.upsert mutation',
    );
  });

export async function createOrgAction({
  name,
  webhookId,
}: {
  name: string;
  webhookId?: string;
}) {
  // You may want to get user info from session or context if needed
  return upsertOrgAction({ name, webhookId });
}
