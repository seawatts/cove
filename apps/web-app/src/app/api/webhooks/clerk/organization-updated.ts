import type { OrganizationJSON, WebhookEvent } from '@clerk/nextjs/server';
import { posthog } from '@cove/analytics/posthog/server';
import { db } from '@cove/db/client';
import { Orgs } from '@cove/db/schema';
import { eq } from 'drizzle-orm';

export async function handleOrganizationUpdated(event: WebhookEvent) {
  // Narrow event.data to OrganizationJSON for 'organization.updated' events
  const orgData = event.data as OrganizationJSON;

  const [org] = await db
    .update(Orgs)
    .set({
      name: orgData.name,
    })
    .where(eq(Orgs.clerkOrgId, orgData.id))
    .returning();

  if (!org) {
    return new Response('Organization not found on organization.updated', {
      status: 400,
    });
  }

  posthog.capture({
    distinctId: org.id,
    event: 'update_organization',
    properties: {
      name: org.name,
    },
  });

  return undefined;
}
