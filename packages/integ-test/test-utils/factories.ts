import type * as schema from '@cove/db/schema';
import {
  ApiKeys,
  type ApiKeyType,
  OrgMembers,
  type OrgMembersType,
  Orgs,
  type OrgType,
  Users,
  type UserType,
} from '@cove/db/schema';
import { createId } from '@cove/id';
import { faker } from '@faker-js/faker';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export class TestFactories {
  constructor(private db: PostgresJsDatabase<typeof schema>) {}

  async createUser(overrides?: Partial<UserType>): Promise<UserType> {
    const user = {
      avatarUrl: faker.image.avatar(),
      clerkId: `clerk_${faker.string.alphanumeric(20)}`,
      createdAt: new Date(),
      email: faker.internet.email(),
      firstName: faker.person.firstName(),
      id: createId({ prefix: 'user' }),
      lastName: faker.person.lastName(),
      online: false,
      ...overrides,
    };

    const [created] = await this.db.insert(Users).values(user).returning();
    if (!created) {
      throw new Error('Failed to create user');
    }
    return created as UserType;
  }

  async createOrg(overrides?: Partial<OrgType>): Promise<OrgType> {
    const user = await this.createUser();

    const org = {
      clerkOrgId: `org_${faker.string.alphanumeric(20)}`,
      createdAt: new Date(),
      createdByUserId: user.id,
      id: createId({ prefix: 'org' }),
      name: faker.company.name(),
      stripeCustomerId: faker.string.alphanumeric(20),
      stripeSubscriptionId: faker.string.alphanumeric(20),
      stripeSubscriptionStatus: 'active' as const,
      ...overrides,
    };

    const [created] = await this.db.insert(Orgs).values(org).returning();
    if (!created) {
      throw new Error('Failed to create org');
    }
    return created as OrgType;
  }

  async createOrgMember(
    userId: string,
    orgId: string,
    role: 'user' | 'admin' | 'superAdmin' = 'user',
  ): Promise<OrgMembersType> {
    const member = {
      createdAt: new Date(),
      id: createId({ prefix: 'member' }),
      orgId,
      role,
      userId,
    };

    const [created] = await this.db
      .insert(OrgMembers)
      .values(member)
      .returning();
    if (!created) {
      throw new Error('Failed to create org member');
    }
    return created as OrgMembersType;
  }

  async createApiKey(
    userId: string,
    orgId: string,
    overrides?: Partial<ApiKeyType>,
  ): Promise<ApiKeyType> {
    const apiKey = {
      createdAt: new Date(),
      id: createId({ prefix: 'ak' }),
      isActive: true,
      key: faker.string.alphanumeric(64),
      name: faker.lorem.words(2),
      orgId,
      userId,
      ...overrides,
    };

    const [created] = await this.db.insert(ApiKeys).values(apiKey).returning();
    if (!created) {
      throw new Error('Failed to create API key');
    }
    return created as ApiKeyType;
  }

  async createCompleteSetup(overrides?: {
    user?: Partial<UserType>;
    org?: Partial<OrgType>;
  }) {
    // Create user
    const user = await this.createUser(overrides?.user);

    // Create org
    const org = await this.createOrg({
      createdByUserId: user.id,
      ...overrides?.org,
    });

    // Add user as org member
    await this.createOrgMember(user.id, org.id, 'admin');

    return { org, user };
  }
}
