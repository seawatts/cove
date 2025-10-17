import { describe, expect, it } from 'vitest';
import { TestFactories } from '../test-utils/factories';
import { testDb } from './setup';

describe('Basic Integration Tests', () => {
  let factories: TestFactories;

  beforeEach(async () => {
    factories = new TestFactories(testDb.db);
  });

  it('should create a user', async () => {
    const user = await factories.createUser();
    expect(user).toBeDefined();
    expect(user.id).toMatch(/^user_/);
    expect(user.email).toBeDefined();
  });
});
