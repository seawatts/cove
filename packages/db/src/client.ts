import { sql } from '@vercel/postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { drizzle as drizzleVercel } from 'drizzle-orm/vercel-postgres';
import postgres from 'postgres';

import { env } from './env.server';
import * as schema from './schema';

const isProd = env.VERCEL_ENV === 'production';

console.log('Database client initialization:');
console.log('POSTGRES_URL:', env.POSTGRES_URL ? 'SET' : 'NOT SET');
console.log('VERCEL_ENV:', env.VERCEL_ENV);
console.log('isProd:', isProd);

export const db = isProd
  ? drizzleVercel(sql, { schema })
  : drizzle(
      postgres(env.POSTGRES_URL, {
        connect_timeout: 10,
        idle_timeout: 20,
        max: 10, // connection pool size
      }),
      { schema },
    );

export { sql };
