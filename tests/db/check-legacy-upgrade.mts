// Run in its own process (in-memory PGlite): a database created by the old
// init.sql, with a sale from before sale_items existed, is upgraded on start.
import fs from 'fs';
import assert from 'node:assert/strict';
import { sql } from 'drizzle-orm';
import { db } from '../../src/db/index';
import { runMigrations } from '../../src/db/migrations';

const rows = (r: any) => r.rows ?? r;
const exec = (q: string) => (db as any).$client.exec(q);

await exec(fs.readFileSync(new URL('./fixtures/legacy-init.sql', import.meta.url), 'utf8'));
await exec(`
  INSERT INTO customers (name, id_number) VALUES ('Legacy', 'L1');
  ALTER TABLE stock ADD COLUMN IF NOT EXISTS price NUMERIC(15,2);
  INSERT INTO stock (barcode, category, stock_type, weight_grams, metal_type, fineness, status) VALUES ('OLD1', 'Jewellery', 'on-display', 2.5, 'Or', '18K', 'Vendu');
  INSERT INTO sales (customer_id, stock_id, payment_mode, qty, item_details, amount, vat_15, weight, metal_type, fineness) VALUES (1, 1, 'Cash', 1, 'Old ring', 1000, 150, 2.5, 'Or', '18K');
  INSERT INTO receipts (sale_id, print_count) VALUES (1, 1);
  INSERT INTO receipts (sale_id, print_count, file_url) VALUES (1, 2, 'x.pdf');
`);

await runMigrations();

const items = rows(await db.execute(sql`SELECT * FROM sale_items`));
assert.equal(items.length, 1, 'legacy sale copied into sale_items');
assert.equal(items[0].barcode, 'OLD1');
assert.equal(items[0].vat_15, '150.00', 'line VAT backfilled from the sale');
const receipts = rows(await db.execute(sql`SELECT * FROM receipts`));
assert.equal(receipts.length, 1, 'duplicate receipts merged');
assert.equal(receipts[0].print_count, 3, 'print counts added up');
assert.equal(receipts[0].file_url, 'x.pdf', 'stored file kept');
assert.equal(rows(await db.execute(sql`SELECT status FROM sales`))[0].status, 'Completed');
assert.equal(rows(await db.execute(sql`SELECT token_version FROM users`))[0].token_version, 0);
assert.equal(rows(await db.execute(sql`SELECT count(*)::int AS n FROM settings WHERE key LIKE 'shop_%'`))[0].n, 6);

const journal = rows(await db.execute(sql`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`))[0].n;
await runMigrations();
assert.equal(rows(await db.execute(sql`SELECT count(*)::int AS n FROM sale_items`))[0].n, 1, 'second start adds nothing');
assert.equal(rows(await db.execute(sql`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`))[0].n, journal, 'second start applies nothing');
console.log('legacy upgrade: ok');
