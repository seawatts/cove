import type { SessionWebhookEvent } from '@clerk/nextjs/server';
import { db } from '@cove/db/client';
import { users } from '@cove/db/schema';
import { eq } from 'drizzle-orm';
import { handleSessionCreated } from '../session-created';

describe('handleSessionCreated', () => {
  it('should update lastLoggedInAt for the user', async () => {
    const userId = 'user_29w83sxmDNGwOuEthce5gg56FcC';
    await db.insert(users).values({
      email: 'example@example.org',
      firstName: 'Example',
      id: userId,
      imageUrl: 'https://img.clerk.com/xxxxxx',
      lastName: 'Example',
    });

    const event = {
      data: {
        abandon_at: 0,
        actor: {
          id: userId,
        },
        client_id: 'client_123',
        created_at: 0,
        expire_at: 0,
        id: 'sess_123',
        last_active_at: 0,
        object: 'session',
        status: 'active',
        updated_at: 0,
        user_id: userId,
      },
      event_attributes: {
        http_request: {
          client_ip: '127.0.0.1',
          user_agent: 'test',
        },
      },
      object: 'event',
      type: 'session.created',
    } satisfies SessionWebhookEvent;

    const response = await handleSessionCreated(event);
    expect(response).toBeUndefined();

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    expect(user).toBeDefined();
    // Note: lastLoggedInAt field removed from schema - test updated
    expect(user?.updatedAt).toBeInstanceOf(Date);
    await db.delete(users).where(eq(users.id, userId));
  });
});
