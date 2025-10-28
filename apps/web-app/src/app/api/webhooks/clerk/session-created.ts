import type { SessionJSON, WebhookEvent } from '@clerk/nextjs/server';
import { posthog } from '@cove/analytics/posthog/server';
import { db } from '@cove/db/client';
import { users } from '@cove/db/schema';
import { eq } from 'drizzle-orm';

export async function handleSessionCreated(event: WebhookEvent) {
  // Narrow event.data to SessionJSON for 'session.created' events
  const sessionData = event.data as SessionJSON;

  const existingUser = await db.query.users.findFirst({
    where: eq(users.id, sessionData.user_id),
  });

  if (!existingUser) {
    console.log('User not found on session.created', sessionData.user_id);
    return new Response('', { status: 200 });
  }

  const [user] = await db
    .update(users)
    .set({
      updatedAt: new Date(),
    })
    .where(eq(users.id, sessionData.user_id))
    .returning();

  if (!user) {
    return new Response('User not found on session.created', { status: 400 });
  }

  posthog.capture({
    distinctId: user.id,
    event: 'login',
    properties: {
      email: user.email,
    },
  });

  return undefined;
}
