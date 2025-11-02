import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  client: {},
  clientPrefix: 'PUBLIC_',
  runtimeEnv: {
    DB_PATH: process.env.DB_PATH,
    DEBUG: process.env.DEBUG,
    HUB_ID: process.env.HUB_ID,
    LOG_LEVEL: process.env.LOG_LEVEL,
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
  },
  server: {
    DB_PATH: z.string().default('./data/hub.db'),
    DEBUG: z.string().default('cove:*'),
    HUB_ID: z.string().optional(),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),
    PORT: z.coerce.number().default(3200),
  },
});
