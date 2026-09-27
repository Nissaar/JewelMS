// Run in its own process (in-memory PGlite): a database created from init.sql
// needs no migration and gets its defaults on first start.
import fs from 'fs';
import assert from 'node:assert/strict';
import { sql } from 'drizzle-orm';
import { db } from '../../src/db/index';
import { runMigrations } from '../../src/db/migrations';

const rows = (r: any) => r.rows ?? r;
await (db as any).$client.exec(fs.readFileSync(new URL('../../init.sql', import.meta.url), 'utf8'));
const before = rows(await db.execute(sql`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`))[0].n;

await runMigrations();

assert.equal(rows(await db.execute(sql`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`))[0].n, before, 'no migration re-applied');
assert.equal(rows(await db.execute(sql`SELECT username FROM users`))[0]?.username, 'admin', 'admin seeded');
assert.ok(rows(await db.execute(sql`SELECT count(*)::int AS n FROM settings`))[0].n >= 15, 'settings seeded');
assert.ok(rows(await db.execute(sql`SELECT to_regclass('public.notification_log') IS NOT NULL AS ok`))[0].ok, 'latest tables exist');
console.log('fresh install: ok');
