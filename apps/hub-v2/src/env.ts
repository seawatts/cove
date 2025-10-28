import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  client: {},
  clientPrefix: 'PUBLIC_',
  runtimeEnv: {
    DB_PATH: process.env.DB_PATH,
    HUB_ID: process.env.HUB_ID,
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
  },
  server: {
    DB_PATH: z.string().default('./data/hub-v2.db'),
    HUB_ID: z.string().optional(),
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),
    PORT: z.coerce.number().default(3200),
  },
});
