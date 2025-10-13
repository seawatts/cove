/**
 * Hub Configuration
 */

import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  runtimeEnv: process.env,
  server: {
    // Discovery
    DISCOVERY_ENABLED: z.coerce.boolean().default(true),
    DISCOVERY_INTERVAL: z.coerce.number().default(300), // 5 minutes
    HOST: z.string().default('0.0.0.0'),
    // Hub identification
    HUB_ID: z.string().optional(),
    HUB_NAME: z.string().default('Cove Hub'),
    HUB_VERSION: z.string().default('0.1.0'),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional().default(''),

    // Supabase (optional - can run without cloud sync)
    NEXT_PUBLIC_SUPABASE_URL: z.string().optional().default(''),

    // Development
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),

    // Server configuration
    PORT: z.coerce.number().default(3100),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional().default(''),

    // Telemetry
    TELEMETRY_INTERVAL: z.coerce.number().default(30), // 30 seconds
  },
  skipValidation:
    process.env.SKIP_ENV_VALIDATION === 'true' ||
    process.env.NODE_ENV === 'development',
});

export type HubEnv = typeof env;
