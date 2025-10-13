/**
 * Test setup for protocols package
 */

// Set environment variables for tests
process.env.NODE_ENV = 'test';
process.env.SKIP_ENV_VALIDATION = 'true';

// Suppress debug logs during tests unless DEBUG env var is set
if (!process.env.DEBUG) {
  process.env.DEBUG = '';
}
