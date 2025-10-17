import type { User } from '@cove/db';
import type * as schema from '@cove/db/schema';
import { users } from '@cove/db/schema';
import { createId } from '@cove/id';
import { faker } from '@faker-js/faker';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export class TestFactories {
  constructor(private db: PostgresJsDatabase<typeof schema>) { }

  async createUser(overrides?: Partial<User>): Promise<User> {
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

    const [created] = await this.db.insert(users).values(user).returning();
    if (!created) {
      throw new Error('Failed to create user');
    }
    return created as User;
  }
}
