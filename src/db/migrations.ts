import { db, isPglite } from "./index";
import { settings, users } from "./schema";
import { sql } from "drizzle-orm";

/**
 * Idempotent schema fixes and default-data seeding, run once at startup.
 * Failures are logged but non-fatal: the server still boots so the problem is
 * visible through the app rather than a silent exit.
 */
export async function runMigrations() {
// Run one-time database migrations/fixes
try {
  if (isPglite) {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("PGlite schema migrated successfully.");
  }

  await db.execute(sql`ALTER TABLE stock DROP CONSTRAINT IF EXISTS stock_category_check;`);
  await db.execute(sql`ALTER TABLE stock ALTER COLUMN category TYPE VARCHAR(100);`);
  await db.execute(sql`ALTER TABLE stock ADD COLUMN IF NOT EXISTS price NUMERIC(15, 2) DEFAULT 0.00;`);
  await db.execute(sql`ALTER TABLE stock ADD COLUMN IF NOT EXISTS price_net NUMERIC(15, 2) DEFAULT 0.00;`);
  await db.execute(sql`ALTER TABLE stock ADD COLUMN IF NOT EXISTS price_vat NUMERIC(15, 2) DEFAULT 0.00;`);
  await db.execute(sql`ALTER TABLE stock ADD COLUMN IF NOT EXISTS item_code VARCHAR(100);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_stock_item_code ON stock(item_code);`);
  await db.execute(sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(15, 2);`);
  await db.execute(sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC(5, 2);`);
  await db.execute(sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS linked_odf_id INTEGER REFERENCES odf(id) ON DELETE SET NULL;`);
  await db.execute(sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS linked_commande_id INTEGER REFERENCES orders(id) ON DELETE SET NULL;`);
  await db.execute(sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Completed' NOT NULL;`);
  await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Pending' NOT NULL;`);
  await db.execute(sql`ALTER TABLE sales DROP COLUMN IF EXISTS gold_rate;`);
  await db.execute(sql`ALTER TABLE orders DROP COLUMN IF EXISTS gold_rate;`);
  
  // Make customers.id_number nullable for over-the-counter sales
  await db.execute(sql`ALTER TABLE customers ALTER COLUMN id_number DROP NOT NULL;`);
  
  // Clean up brand field for Jewellery items
  await db.execute(sql`UPDATE stock SET brand = NULL WHERE category = 'Jewellery' AND brand IS NOT NULL;`);
  
  // Create odf_items table if not exists
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS odf_items (
      id SERIAL PRIMARY KEY,
      odf_id INTEGER REFERENCES odf(id) ON DELETE CASCADE NOT NULL,
      description TEXT NOT NULL,
      mass NUMERIC(10, 3) NOT NULL,
      fineness VARCHAR(20) NOT NULL,
      price NUMERIC(15, 2) DEFAULT 0.00,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    );
  `);
  await db.execute(sql`ALTER TABLE odf_items ADD COLUMN IF NOT EXISTS price NUMERIC(15, 2) DEFAULT 0.00;`);

  // Create sale_items table if not exists
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS sale_items (
      id SERIAL PRIMARY KEY,
      sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE NOT NULL,
      stock_id INTEGER REFERENCES stock(id) ON DELETE SET NULL,
      barcode VARCHAR(100),
      item_details TEXT,
      qty INTEGER DEFAULT 1 NOT NULL,
      unit_sales_price NUMERIC(15, 2),
      amount NUMERIC(15, 2),
      weight NUMERIC(10, 3),
      fineness VARCHAR(20),
      metal_type VARCHAR(50),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    );
  `);
  console.log("Database migrations: stock_category_check dropped, category length increased, price added, gold_rate columns dropped, odf_items, and sale_items tables verified.");

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
} catch (err) {
  console.error("Migration error (non-fatal):", err);
}

}
