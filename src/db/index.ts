import { drizzle as drizzlePg, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import * as schema from './schema';

/**
 * The application database. Production uses PostgreSQL (DATABASE_URL); local
 * development without one uses an in-memory PGlite, which exposes the same
 * query API, so it's typed as the node-postgres database throughout.
 */
export type Database = NodePgDatabase<typeof schema>;
/** A transaction handle, as passed to db.transaction() callbacks. */
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

if (!process.env.DATABASE_URL && process.env.NODE_ENV === 'production') {
  // The in-memory fallback would run normally and lose every sale on restart.
  throw new Error('DATABASE_URL is not set. Refusing to start in production without a real database.');
}

export const isPglite = !process.env.DATABASE_URL;

export const db: Database = isPglite
  ? (drizzlePglite(new PGlite(), { schema }) as unknown as Database)
  : drizzlePg(new pg.Pool({ connectionString: process.env.DATABASE_URL }), { schema });
