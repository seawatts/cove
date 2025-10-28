import { afterEach, expect, mock } from 'bun:test';
import * as matchers from '@testing-library/jest-dom/matchers';
import { cleanup } from '@testing-library/react';

expect.extend(matchers);

// Global mocks to prevent environment variable errors during test loading

// Mock environment variables
mock.module('./env.server', () => ({
  env: {
    POSTGRES_URL: 'postgresql://test:test@localhost:5432/test',
    STRIPE_PUBLISHABLE_KEY: 'pk_test_123',
    STRIPE_SECRET_KEY: 'sk_test_123',
    STRIPE_WEBHOOK_SECRET: 'whsec_test_123',
    VERCEL_ENV: 'development',
  },
}));

// Clean up after each test
afterEach(() => {
  cleanup();
});
