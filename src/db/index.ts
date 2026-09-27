import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import * as schema from './schema';

export let db: any;
export let isPglite = false;

if (!process.env.DATABASE_URL && process.env.NODE_ENV === 'production') {
  // The in-memory fallback would run normally and lose every sale on restart.
  throw new Error('DATABASE_URL is not set. Refusing to start in production without a real database.');
}

if (process.env.DATABASE_URL) {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });
  db = drizzlePg(pool, { schema });
} else {
  const client = new PGlite();
  db = drizzlePglite(client, { schema });
  isPglite = true;
}
