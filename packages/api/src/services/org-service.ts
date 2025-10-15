/**
 * Organization Service
 * Handles business orchestration for organization creation and management
 * Coordinates between Clerk (auth), Stripe (billing), and Database (persistence)
 */

import {
  clerkClient,
  type Organization,
  type User,
} from '@clerk/nextjs/server';
import { eq } from '@cove/db';
import { db } from '@cove/db/client';
import { ApiKeys, OrgMembers, Orgs, Users } from '@cove/db/schema';
import { generateRandomName, generateUniqueOrgName } from '@cove/id';
import {
  BILLING_INTERVALS,
  createSubscription,
  getFreePlanPriceId,
  PLAN_TYPES,
  upsertStripeCustomer,
} from '@cove/stripe';
import type Stripe from 'stripe';

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// ============================================================================
// Types
// ============================================================================

type CreateOrgParams = {
  name: string;
  userId: string;
};

type UpsertOrgParams = {
  orgId?: string;
  name: string;
  userId: string;
};

type OrgResult = {
  org: {
    id: string;
    name: string;
    stripeCustomerId: string;
  };
  apiKey: {
    id: string;
    key: string;
    name: string;
  };
};

// ============================================================================
// Helper Functions - User Management
// ============================================================================

async function ensureUserExists({
  userId,
  userEmail,
  userFirstName,
  userLastName,
  userAvatarUrl,
  tx,
}: {
  userId: string;
  userEmail: string;
  userFirstName?: string | null;
  userLastName?: string | null;
  userAvatarUrl?: string | null;
  tx: Transaction;
}) {
  const existingUser = await tx.query.Users.findFirst({
    where: eq(Users.id, userId),
  });

  if (existingUser) {
    return existingUser;
  }

  const [dbUser] = await tx
    .insert(Users)
    .values({
      avatarUrl: userAvatarUrl ?? null,
      clerkId: userId,
      email: userEmail,
      firstName: userFirstName ?? null,
      id: userId,
      lastLoggedInAt: new Date(),
      lastName: userLastName ?? null,
    })
    .onConflictDoUpdate({
      set: {
        avatarUrl: userAvatarUrl ?? null,
        email: userEmail,
        firstName: userFirstName ?? null,
        lastLoggedInAt: new Date(),
        lastName: userLastName ?? null,
        updatedAt: new Date(),
      },
      target: Users.clerkId,
    })
    .returning();

  if (!dbUser) {
    throw new Error(
      `Failed to create user for userId: ${userId}, email: ${userEmail}`,
    );
  }

  return dbUser;
}

// ============================================================================
// Helper Functions - API Key Management
// ============================================================================

async function ensureDefaultApiKey({
  orgId,
  userId,
  tx,
}: {
  orgId: string;
  userId: string;
  tx: Transaction;
}) {
  const existingApiKey = await tx.query.ApiKeys.findFirst({
    where: eq(ApiKeys.orgId, orgId),
  });

  if (existingApiKey) {
    return existingApiKey;
  }

  const [apiKey] = await tx
    .insert(ApiKeys)
    .values({
      name: 'Default',
      orgId,
      userId,
    })
    .onConflictDoUpdate({
      set: {
        updatedAt: new Date(),
      },
      target: ApiKeys.key,
    })
    .returning();

  if (!apiKey) {
    throw new Error(
      `Failed to create API key for orgId: ${orgId}, userId: ${userId}`,
    );
  }

  return apiKey;
}

// ============================================================================
// Helper Functions - Organization Management
// ============================================================================

async function createOrgInDatabase({
  clerkOrgId,
  name,
  userId,
  tx,
}: {
  clerkOrgId: string;
  name: string;
  userId: string;
  tx: Transaction;
}) {
  const [org] = await tx
    .insert(Orgs)
    .values({
      clerkOrgId,
      createdByUserId: userId,
      id: clerkOrgId,
      name,
    })
    .returning();

  if (!org) {
    throw new Error(
      `Failed to create organization for clerkOrgId: ${clerkOrgId}, name: ${name}, userId: ${userId}`,
    );
  }

  return org;
}

async function upsertOrgInDatabase({
  clerkOrgId,
  name,
  userId,
  stripeCustomerId,
  tx,
}: {
  clerkOrgId: string;
  name: string;
  userId: string;
  stripeCustomerId?: string;
  tx: Transaction;
}) {
  const [org] = await tx
    .insert(Orgs)
    .values({
      clerkOrgId,
      createdByUserId: userId,
      id: clerkOrgId,
      name,
      stripeCustomerId,
    })
    .onConflictDoUpdate({
      set: {
        name,
        stripeCustomerId,
        updatedAt: new Date(),
      },
      target: [Orgs.clerkOrgId],
    })
    .returning();

  if (!org) {
    throw new Error(
      `Failed to create or update organization for clerkOrgId: ${clerkOrgId}, name: ${name}, userId: ${userId}`,
    );
  }

  return org;
}

async function updateOrgWithStripeCustomerId({
  orgId,
  stripeCustomerId,
  tx,
}: {
  orgId: string;
  stripeCustomerId: string;
  tx: Transaction;
}) {
  await tx
    .update(Orgs)
    .set({
      stripeCustomerId,
      updatedAt: new Date(),
    })
    .where(eq(Orgs.id, orgId));
}

async function ensureOrgMembership({
  orgId,
  userId,
  tx,
}: {
  orgId: string;
  userId: string;
  tx: Transaction;
}) {
  await tx
    .insert(OrgMembers)
    .values({
      orgId,
      role: 'admin',
      userId,
    })
    .onConflictDoUpdate({
      set: {
        updatedAt: new Date(),
      },
      target: [OrgMembers.orgId, OrgMembers.userId],
    });
}

// ============================================================================
// Helper Functions - Stripe Integration
// ============================================================================

async function autoSubscribeToFreePlan({
  customerId,
  orgId,
  tx,
}: {
  customerId: string;
  orgId: string;
  tx: Transaction;
}) {
  try {
    // Get the free plan price ID
    const freePriceId = await getFreePlanPriceId();
    if (!freePriceId) {
      console.error(
        `Failed to get free plan price ID for orgId: ${orgId}, customerId: ${customerId}`,
      );
      return null;
    }

    // Create subscription to free plan
    const subscription = await createSubscription({
      billingInterval: BILLING_INTERVALS.MONTHLY,
      customerId,
      orgId,
      planType: PLAN_TYPES.FREE,
      priceId: freePriceId,
    });

    if (!subscription) {
      console.error(
        `Failed to create subscription for orgId: ${orgId}, customerId: ${customerId}, priceId: ${freePriceId}`,
      );
      return null;
    }

    // Update org with subscription info
    await tx
      .update(Orgs)
      .set({
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        stripeSubscriptionStatus: subscription.status,
        updatedAt: new Date(),
      })
      .where(eq(Orgs.id, orgId));

    console.log(
      `Auto-subscribed org ${orgId} to free plan with subscription ${subscription.id}`,
    );
    return subscription;
  } catch (error) {
    if (error instanceof Error) {
      console.error(
        `Failed to auto-subscribe to free plan for orgId: ${orgId}, customerId: ${customerId}. Original error: ${error.message}`,
      );
    } else {
      console.error(
        `Failed to auto-subscribe to free plan for orgId: ${orgId}, customerId: ${customerId}`,
      );
    }
    // Don't throw error - org creation should still succeed
    return null;
  }
}

// ============================================================================
// Helper Functions - Upsert-specific
// ============================================================================

async function findExistingOrg({
  orgId,
  userId,
  tx,
}: {
  orgId?: string;
  userId: string;
  tx: Transaction;
}): Promise<{
  org: {
    id: string;
    clerkOrgId: string;
    name: string;
    stripeCustomerId: string | null;
  };
  reason: string;
} | null> {
  // Run all possible org existence checks in parallel
  const [existingMembership, existingOrgByOrgId, existingOrgByUser] =
    await Promise.all([
      // Check 1: User already has an org membership
      tx.query.OrgMembers.findFirst({
        where: eq(OrgMembers.userId, userId),
      }),
      // Check 2: If orgId is provided, check if organization already exists
      orgId
        ? tx.query.Orgs.findFirst({
            where: eq(Orgs.clerkOrgId, orgId),
          })
        : null,
      // Check 3: User has created any organization
      !orgId
        ? tx.query.Orgs.findFirst({
            where: eq(Orgs.createdByUserId, userId),
          })
        : null,
    ]);

  // Check 1: User already has an org membership
  if (existingMembership && !orgId) {
    const existingOrg = await tx.query.Orgs.findFirst({
      where: eq(Orgs.id, existingMembership.orgId),
    });

    if (existingOrg) {
      // Run API key check
      const apiKey = await tx.query.ApiKeys.findFirst({
        where: eq(ApiKeys.orgId, existingOrg.id),
      });

      if (apiKey) {
        return { org: existingOrg, reason: 'existing_membership' };
      }
    }
  }

  // Check 2: If orgId is provided, check if organization already exists
  if (existingOrgByOrgId) {
    console.log(
      'Organization already exists for orgId:',
      orgId,
      'using existing org:',
      existingOrgByOrgId.id,
    );
    return { org: existingOrgByOrgId, reason: 'existing_org_id' };
  }

  // Check 3: User has created any organization
  if (existingOrgByUser && !orgId) {
    console.log(
      'User already has an organization:',
      existingOrgByUser.id,
      'using existing org',
    );
    return { org: existingOrgByUser, reason: 'existing_user_org' };
  }

  return null;
}

async function buildOrgResult({
  org,
  tx,
  userId,
}: {
  org: {
    id: string;
    clerkOrgId: string;
    name: string;
    stripeCustomerId: string | null;
  };
  tx: Transaction;
  userId: string;
}): Promise<OrgResult> {
  // Run membership and API key creation in parallel
  const [_, apiKey] = await Promise.all([
    ensureOrgMembership({ orgId: org.id, tx, userId }),
    ensureDefaultApiKey({ orgId: org.id, tx, userId }),
  ]);

  return {
    apiKey: {
      id: apiKey.id,
      key: apiKey.key,
      name: apiKey.name,
    },
    org: {
      id: org.clerkOrgId,
      name: org.name,
      stripeCustomerId: org.stripeCustomerId || '',
    },
  };
}

// ============================================================================
// Public API - Create Organization
// ============================================================================

/**
 * Creates a new organization with Stripe integration and API key
 * This function is specifically designed for onboarding new users
 */
export async function createOrg({
  name,
  userId,
}: CreateOrgParams): Promise<OrgResult> {
  return await db.transaction(async (tx) => {
    // Run Clerk client initialization and user existence check in parallel
    const [client, existingUser] = await Promise.all([
      clerkClient(),
      tx.query.Users.findFirst({
        where: eq(Users.id, userId),
      }),
    ]);

    let user: User;
    let userEmail: string;

    try {
      user = await client.users.getUser(userId);
      const emailAddress = user.primaryEmailAddress?.emailAddress;
      if (!emailAddress) {
        throw new Error(`User email not found for userId: ${userId}`);
      }
      userEmail = emailAddress;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(
          `Failed to retrieve user from Clerk for userId: ${userId}. Original error: ${error.message}`,
        );
      }
      throw new Error(
        `Failed to retrieve user from Clerk for userId: ${userId}`,
      );
    }

    // Ensure user exists in database before proceeding (only if user doesn't exist)
    if (!existingUser) {
      await ensureUserExists({
        tx,
        userAvatarUrl: user.imageUrl,
        userEmail,
        userFirstName: user.firstName,
        userId,
        userLastName: user.lastName,
      });
    }

    // Check if organization name already exists in database
    const existingOrgByName = await tx.query.Orgs.findFirst({
      where: eq(Orgs.name, name),
    });

    if (existingOrgByName) {
      throw new Error(
        `Organization name "${name}" is already taken. Please choose a different name.`,
      );
    }

    // Generate unique slug
    const slug = generateRandomName();
    let clerkOrg: Organization;

    try {
      clerkOrg = await client.organizations.createOrganization({
        createdBy: userId,
        name,
        slug,
      });

      if (!clerkOrg) {
        throw new Error(
          `Failed to create organization in Clerk for name: ${name}, slug: ${slug}, userId: ${userId}`,
        );
      }
    } catch (error: unknown) {
      // Handle case where organization with same slug already exists
      if (error && typeof error === 'object' && 'message' in error) {
        const errorMessage = (error as { message: string }).message;
        if (
          errorMessage.indexOf('slug') !== -1 ||
          errorMessage.indexOf('already exists') !== -1
        ) {
          throw new Error(
            `Organization slug "${slug}" is already taken. Please try again.`,
          );
        }
      }

      // For other errors, throw immediately
      if (error instanceof Error) {
        throw new Error(
          `Failed to create organization in Clerk for name: ${name}, userId: ${userId}. Original error: ${error.message}`,
        );
      }
      throw new Error(
        `Failed to create organization in Clerk for name: ${name}, userId: ${userId}`,
      );
    }

    // Ensure clerkOrg is assigned
    if (!clerkOrg) {
      throw new Error('Failed to create organization in Clerk');
    }

    // Final check: Double-check that the organization wasn't created by another process
    const finalCheckOrg = await tx.query.Orgs.findFirst({
      where: eq(Orgs.clerkOrgId, clerkOrg.id),
    });

    if (finalCheckOrg) {
      console.log(
        'Organization was created by another process (likely webhook), using existing org:',
        finalCheckOrg.id,
      );

      // Get or create API key for existing org
      const apiKey = await ensureDefaultApiKey({
        orgId: finalCheckOrg.id,
        tx,
        userId,
      });

      return {
        apiKey: {
          id: apiKey.id,
          key: apiKey.key,
          name: apiKey.name,
        },
        org: {
          id: finalCheckOrg.clerkOrgId,
          name: finalCheckOrg.name,
          stripeCustomerId: finalCheckOrg.stripeCustomerId || '',
        },
      };
    }

    // Create org in database
    const org = await createOrgInDatabase({
      clerkOrgId: clerkOrg.id,
      name,
      tx,
      userId,
    });

    // Create or update Stripe customer
    console.log(
      'Creating/updating Stripe customer for org:',
      org.id,
      'name:',
      name,
    );

    let stripeCustomer: Stripe.Customer;
    try {
      stripeCustomer = await upsertStripeCustomer({
        additionalMetadata: {
          orgName: name,
          userId,
        },
        email: userEmail,
        name,
        orgId: org.id,
      });
      if (!stripeCustomer) {
        throw new Error(
          `Failed to create or get Stripe customer for orgId: ${org.id}, name: ${name}, email: ${userEmail}`,
        );
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(
          `Failed to create or get Stripe customer for orgId: ${org.id}, name: ${name}, email: ${userEmail}. Original error: ${error.message}`,
        );
      }
      throw new Error(
        `Failed to create or get Stripe customer for orgId: ${org.id}, name: ${name}, email: ${userEmail}`,
      );
    }

    console.log(
      'Stripe customer created/updated:',
      stripeCustomer.id,
      'for org:',
      org.id,
    );

    // Run database updates and Clerk update in parallel
    await Promise.all([
      // Update org in database with Stripe customer ID
      updateOrgWithStripeCustomerId({
        orgId: org.id,
        stripeCustomerId: stripeCustomer.id,
        tx,
      }),
      // Update org in Clerk with Stripe customer ID
      client.organizations.updateOrganization(clerkOrg.id, {
        name,
        privateMetadata: {
          stripeCustomerId: stripeCustomer.id,
        },
      }),
    ]);

    // Auto-subscribe to free plan
    await autoSubscribeToFreePlan({
      customerId: stripeCustomer.id,
      orgId: org.id,
      tx,
    });

    // Create default API key
    const apiKey = await ensureDefaultApiKey({
      orgId: org.id,
      tx,
      userId,
    });

    return {
      apiKey: {
        id: apiKey.id,
        key: apiKey.key,
        name: apiKey.name,
      },
      org: {
        id: org.clerkOrgId,
        name: org.name,
        stripeCustomerId: stripeCustomer.id,
      },
    };
  });
}

// ============================================================================
// Public API - Upsert Organization
// ============================================================================

/**
 * Creates or updates an organization with Stripe integration
 * Handles both new organization creation and existing organization updates
 */
export async function upsertOrg({
  orgId,
  name,
  userId,
}: UpsertOrgParams): Promise<OrgResult> {
  return await db.transaction(async (tx) => {
    // Check for existing organizations first
    const existingOrgResult = await findExistingOrg({ orgId, tx, userId });
    if (existingOrgResult) {
      return buildOrgResult({
        org: existingOrgResult.org,
        tx,
        userId,
      });
    }

    // Run Clerk client initialization and user existence check in parallel
    const [client, existingUser] = await Promise.all([
      clerkClient(),
      tx.query.Users.findFirst({
        where: eq(Users.id, userId),
      }),
    ]);

    let user: User;
    let userEmail: string;

    try {
      user = await client.users.getUser(userId);
      const emailAddress = user.primaryEmailAddress?.emailAddress;
      if (!emailAddress) {
        throw new Error(`User email not found for userId: ${userId}`);
      }
      userEmail = emailAddress;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(
          `Failed to retrieve user from Clerk for userId: ${userId}. Original error: ${error.message}`,
        );
      }
      throw new Error(
        `Failed to retrieve user from Clerk for userId: ${userId}`,
      );
    }

    // Ensure user exists in database before proceeding (only if user doesn't exist)
    if (!existingUser) {
      await ensureUserExists({
        tx,
        userAvatarUrl: user.imageUrl,
        userEmail,
        userFirstName: user.firstName,
        userId,
        userLastName: user.lastName,
      });
    }

    let clerkOrg: Organization | undefined;
    let slug: string | undefined;
    let finalOrgName = name; // Track the final organization name

    if (orgId) {
      // Update org in Clerk
      try {
        clerkOrg = await client.organizations.updateOrganization(orgId, {
          name,
        });
        if (!clerkOrg) {
          throw new Error(
            `Failed to update organization in Clerk for orgId: ${orgId}, name: ${name}`,
          );
        }
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(
            `Failed to update organization in Clerk for orgId: ${orgId}, name: ${name}. Original error: ${error.message}`,
          );
        }
        throw new Error(
          `Failed to update organization in Clerk for orgId: ${orgId}, name: ${name}`,
        );
      }
    } else {
      // Create new org in Clerk with unique name and slug
      let orgName = name;
      let attempts = 0;
      const maxAttempts = 5;

      while (attempts < maxAttempts) {
        try {
          // Check if organization name already exists in database
          const existingOrgByName = await tx.query.Orgs.findFirst({
            where: eq(Orgs.name, orgName),
          });

          if (existingOrgByName) {
            // Generate a new unique name
            orgName = generateUniqueOrgName();
            attempts++;
            continue;
          }

          // Generate unique slug
          slug = generateRandomName();

          clerkOrg = await client.organizations.createOrganization({
            createdBy: userId,
            name: orgName,
            slug,
          });

          if (!clerkOrg) {
            throw new Error(
              `Failed to create organization in Clerk for name: ${orgName}, slug: ${slug}, userId: ${userId}`,
            );
          }

          // Successfully created, break out of the loop
          finalOrgName = orgName; // Update the final name
          break;
        } catch (error: unknown) {
          // Handle case where organization with same slug already exists
          if (error && typeof error === 'object' && 'message' in error) {
            const errorMessage = (error as { message: string }).message;
            if (
              errorMessage.indexOf('slug') !== -1 ||
              errorMessage.indexOf('already exists') !== -1
            ) {
              // Try with a different slug
              attempts++;
              continue;
            }
          }

          // For other errors, throw immediately
          if (error instanceof Error) {
            throw new Error(
              `Failed to create organization in Clerk for name: ${orgName}, slug: ${slug}, userId: ${userId}. Original error: ${error.message}`,
            );
          }
          throw new Error(
            `Failed to create organization in Clerk for name: ${orgName}, slug: ${slug}, userId: ${userId}`,
          );
        }
      }

      if (attempts >= maxAttempts) {
        throw new Error(
          `Failed to create organization after ${maxAttempts} attempts. Please try again.`,
        );
      }
    }

    // Ensure clerkOrg is assigned
    if (!clerkOrg) {
      throw new Error('Failed to create or update organization in Clerk');
    }

    // Final check: Double-check that the organization wasn't created by another process
    const finalCheckOrg = await tx.query.Orgs.findFirst({
      where: eq(Orgs.clerkOrgId, clerkOrg.id),
    });

    if (finalCheckOrg) {
      console.log(
        'Organization was created by another process (likely webhook), using existing org:',
        finalCheckOrg.id,
      );
      return buildOrgResult({
        org: finalCheckOrg,
        tx,
        userId,
      });
    }

    // Upsert org in database (no Stripe customer ID initially)
    const org = await upsertOrgInDatabase({
      clerkOrgId: clerkOrg.id,
      name: finalOrgName, // Use the final organization name
      tx,
      userId,
    });

    // Create or update Stripe customer
    console.log(
      'Creating/updating Stripe customer for org:',
      org.id,
      'name:',
      name,
    );

    let stripeCustomer: Stripe.Customer;
    try {
      stripeCustomer = await upsertStripeCustomer({
        additionalMetadata: {
          orgName: name,
          userId,
        },
        email: userEmail,
        name,
        orgId: org.id,
      });
      if (!stripeCustomer) {
        throw new Error(
          `Failed to create or get Stripe customer for orgId: ${org.id}, name: ${name}, email: ${userEmail}`,
        );
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(
          `Failed to create or get Stripe customer for orgId: ${org.id}, name: ${name}, email: ${userEmail}. Original error: ${error.message}`,
        );
      }
      throw new Error(
        `Failed to create or get Stripe customer for orgId: ${org.id}, name: ${name}, email: ${userEmail}`,
      );
    }

    console.log(
      'Stripe customer created/updated:',
      stripeCustomer.id,
      'for org:',
      org.id,
    );

    // Run database updates and Clerk update in parallel
    await Promise.all([
      // Update org in database with Stripe customer ID
      updateOrgWithStripeCustomerId({
        orgId: org.id,
        stripeCustomerId: stripeCustomer.id,
        tx,
      }),
      // Update org in Clerk with Stripe customer ID
      client.organizations.updateOrganization(clerkOrg.id, {
        name,
        privateMetadata: {
          stripeCustomerId: stripeCustomer.id,
        },
      }),
    ]);

    // Auto-subscribe to free plan only if org doesn't already have a subscription
    if (!org.stripeSubscriptionId) {
      await autoSubscribeToFreePlan({
        customerId: stripeCustomer.id,
        orgId: org.id,
        tx,
      });
    }

    return buildOrgResult({
      org: { ...org, stripeCustomerId: stripeCustomer.id },
      tx,
      userId,
    });
  });
}
