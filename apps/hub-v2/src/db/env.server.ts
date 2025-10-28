import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  runtimeEnv: {
    HUB_ID: process.env.HUB_ID,
    HUB_NAME: process.env.HUB_NAME,
    HUB_PORT: process.env.HUB_PORT,
    NODE_ENV: process.env.NODE_ENV,
  },
  server: {
    HUB_ID: z.string().optional(),
    HUB_NAME: z.string().default('Cove Hub'),
    HUB_PORT: z.string().default('3001'),
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
  },
  skipValidation:
    !!process.env.CI ||
    process.env.SKIP_ENV_VALIDATION === 'true' ||
    process.env.NODE_ENV === 'development',
});
