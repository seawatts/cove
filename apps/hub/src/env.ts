/**
 * Hub Configuration
 */

import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  emptyStringAsUndefined: true,
  runtimeEnv: process.env,
  server: {
    // Discovery
    DISCOVERY_ENABLED: z.coerce.boolean().default(true),
    DISCOVERY_INTERVAL: z.coerce.number().default(300), // 5 minutes
    HOST: z.string().default('0.0.0.0'),
    // Hub identification
    HUB_ID: z.string().default(''),
    HUB_NAME: z.string().default('Cove Hub'),
    HUB_ORG_ID: z.string().optional(), // Organization ID for device ownership
    HUB_USER_ID: z.string().optional(), // User ID for device ownership
    HUB_VERSION: z.string().default('0.1.0'),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().default(''),

    // Supabase (optional - can run without cloud sync)
    NEXT_PUBLIC_SUPABASE_URL: z.string().default(''),

    // Development
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),

    // Server configuration
    PORT: z.coerce.number().default(3100),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

    // Telemetry
    TELEMETRY_INTERVAL: z.coerce.number().default(30), // 30 seconds
  },
  skipValidation:
    process.env.SKIP_ENV_VALIDATION === 'true' ||
    process.env.NODE_ENV === 'development',
});

export type HubEnv = typeof env;
