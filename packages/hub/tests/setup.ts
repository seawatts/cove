/**
 * Test setup for hub package
 */

// Set environment variables for tests
process.env.SKIP_ENV_VALIDATION = 'true';
process.env.NODE_ENV = 'test';
process.env.HUB_ID = 'test-hub';
process.env.HUB_NAME = 'Test Hub';
process.env.HUB_VERSION = '0.1.0-test';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
process.env.DISCOVERY_ENABLED = 'false';
process.env.PORT = '3100';
process.env.HOST = '0.0.0.0';
