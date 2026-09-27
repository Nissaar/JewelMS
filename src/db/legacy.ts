import { sql } from "drizzle-orm";

/**
 * Brings a database created before drizzle migrations were adopted (from
 * init.sql plus the ALTER statements that used to run at every startup) up
 * to the baseline migration's schema. Runs once, when the database is
 * adopted; afterwards only migrations in drizzle/ change the schema.
 */
export async function upgradeLegacySchema(tx: any) {
  await tx.execute(sql`ALTER TABLE stock DROP CONSTRAINT IF EXISTS stock_category_check;`);
  await tx.execute(sql`ALTER TABLE stock ALTER COLUMN category TYPE VARCHAR(100);`);
  await tx.execute(sql`ALTER TABLE stock ADD COLUMN IF NOT EXISTS price NUMERIC(15, 2) DEFAULT 0.00;`);
  await tx.execute(sql`ALTER TABLE stock ADD COLUMN IF NOT EXISTS price_net NUMERIC(15, 2) DEFAULT 0.00;`);
  await tx.execute(sql`ALTER TABLE stock ADD COLUMN IF NOT EXISTS price_vat NUMERIC(15, 2) DEFAULT 0.00;`);
  await tx.execute(sql`ALTER TABLE stock ADD COLUMN IF NOT EXISTS item_code VARCHAR(100);`);
  await tx.execute(sql`CREATE INDEX IF NOT EXISTS idx_stock_item_code ON stock(item_code);`);
  await tx.execute(sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(15, 2);`);
  await tx.execute(sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC(5, 2);`);
  await tx.execute(sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS linked_odf_id INTEGER REFERENCES odf(id) ON DELETE SET NULL;`);
  await tx.execute(sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS linked_commande_id INTEGER REFERENCES orders(id) ON DELETE SET NULL;`);
  await tx.execute(sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Completed' NOT NULL;`);
  await tx.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Pending' NOT NULL;`);
  await tx.execute(sql`ALTER TABLE sales DROP COLUMN IF EXISTS gold_rate;`);
  await tx.execute(sql`ALTER TABLE orders DROP COLUMN IF EXISTS gold_rate;`);
  
  // Make customers.id_number nullable for over-the-counter sales
  await tx.execute(sql`ALTER TABLE customers ALTER COLUMN id_number DROP NOT NULL;`);
  
  // Clean up brand field for Jewellery items
  await tx.execute(sql`UPDATE stock SET brand = NULL WHERE category = 'Jewellery' AND brand IS NOT NULL;`);
  
  // Create odf_items table if not exists
  await tx.execute(sql`
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
  await tx.execute(sql`ALTER TABLE odf_items ADD COLUMN IF NOT EXISTS price NUMERIC(15, 2) DEFAULT 0.00;`);

  // Create sale_items table if not exists
  await tx.execute(sql`
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
  // Reports read sale_items. Sales recorded before that table existed have
  // their single item on the sale row: copy it over, once.
  await tx.execute(sql`
    INSERT INTO sale_items (sale_id, stock_id, barcode, item_details, qty, unit_sales_price, amount, weight, fineness, metal_type, created_at)
    SELECT s.id, s.stock_id, st.barcode, s.item_details, s.qty, s.unit_sales_price, s.amount, s.weight, s.fineness, s.metal_type, s.created_at
    FROM sales s
    LEFT JOIN stock st ON st.id = s.stock_id
    WHERE NOT EXISTS (SELECT 1 FROM sale_items si WHERE si.sale_id = s.id);
  `);
}
