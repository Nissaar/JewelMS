import path from "path";
import { sql } from "drizzle-orm";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { db, isPglite } from "./index";
import { settings, users } from "./schema";
import { upgradeLegacySchema } from "./legacy";

const MIGRATIONS_FOLDER = path.resolve(process.cwd(), "drizzle");

const firstRow = (result: any) => (result.rows ?? result)[0];

/**
 * Applies schema migrations from drizzle/ and seeds default data, at startup.
 * Any failure stops the server: running on a half-migrated schema corrupts data.
 */
export async function runMigrations() {
  await adoptLegacyDatabase();

  const { migrate } = isPglite
    ? await import("drizzle-orm/pglite/migrator")
    : await import("drizzle-orm/node-postgres/migrator");
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

  await seedDefaults();
}

/**
 * A database that already has tables but no record of the baseline migration
 * was created by init.sql. Upgrade it to the baseline schema and record the
 * baseline as applied, so migrate() only runs the migrations after it.
 */
async function adoptLegacyDatabase() {
  const { has_users } = firstRow(await db.execute(sql`SELECT to_regclass('public.users') IS NOT NULL AS has_users`));
  if (!has_users) return; // empty database: migrate() creates everything

  const [baseline] = readMigrationFiles({ migrationsFolder: MIGRATIONS_FOLDER });
  await db.execute(sql`CREATE SCHEMA IF NOT EXISTS drizzle`);
  await db.execute(sql`CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`);
  const { adopted } = firstRow(await db.execute(
    sql`SELECT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at >= ${baseline.folderMillis}) AS adopted`,
  ));
  if (adopted) return;

  console.log("Existing database without migration history: upgrading it to the baseline schema.");
  await db.transaction(async (tx: any) => {
    await upgradeLegacySchema(tx);
    await tx.execute(sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${baseline.hash}, ${baseline.folderMillis})`);
  });
}

async function seedDefaults() {
  // Seed default data if users/settings don't exist yet
  const existingUsers = await db.select().from(users).limit(1);
  if (existingUsers.length === 0) {
    await db.insert(users).values({
      username: "admin",
      email: "admin@haujee.com",
      passwordHash: "$2b$10$HC4mocVNzdwGPHxu8J/HyeoWDglmA9NlTAXjcrz2MtMO5N3Ycw3LS",
      role: "Admin"
    });
    console.log("Default admin user seeded.");
  }

  const existingSettings = await db.select().from(settings).limit(1);
  if (existingSettings.length === 0) {
    await db.insert(settings).values([
      { key: 'receipt_heading', value: 'Haujee Jewellery - Official Pharmacy of Gold & Silver' },
      { key: 'receipt_policy_wording', value: 'All sales are final. No returns on customized jewellery.' },
      { key: 'stock_categories', value: '["Jewellery", "Pen", "Sewing Machine", "Parts"]' },
      { key: 'stock_metal_types', value: '["Or", "Argent", "Platine"]' },
      { key: 'stock_fineness_options', value: '["18K", "22K", "24K", "925", "950"]' },
      { key: 'stock_pen_brands', value: '["Parker", "Cross", "Waterman", "Montblanc"]' },
      { key: 'stock_sewing_machine_brands', value: '["Singer", "Bernina", "Brother", "Janome"]' },
      { key: 'stock_sub_categories', value: '["Bague", "Collier", "Bracelet", "Boucles d\'oreilles", "Pendentif"]' },
      { key: 'guarantee_options', value: '["0", "1", "2", "3", "5", "10"]' }
    ]);
    console.log("Default settings seeded.");
  }

  // Shop legal details (Settings > Général). Added individually so existing
  // databases get the new keys without touching values already set.
  const { SHOP_SETTING_DEFAULTS } = await import("../services/shopDetails");
  for (const [key, value] of Object.entries(SHOP_SETTING_DEFAULTS)) {
    await db.insert(settings).values({ key, value }).onConflictDoNothing({ target: settings.key });
  }
}
