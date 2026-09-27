import type { Express } from "express";
import type { z } from "zod";
import { db } from "../db/index";
import { settings, stock, customers, sales } from "../db/schema";
import { eq, or, ilike, like, and, sql } from "drizzle-orm";
import { authenticateToken, checkAnyPermission, checkPermission } from "../middleware/auth";
import { idParam, stockBulkEditSchema, stockCreateSchema, stockUpdateSchema } from "../lib/schemas";
import { badRequest, notFound, sendError } from "../lib/errors";
import { escapeLike } from "../lib/sql";

type StockFields = Partial<z.infer<typeof stockUpdateSchema>>;

/**
 * Turns validated input into column values. The price is VAT-inclusive; its
 * net and VAT parts are derived here. Fields absent from the input are left
 * out, so an update never touches what the client didn't send.
 */
function toStockColumns(input: StockFields): Record<string, unknown> {
  const { price, weightGrams, ...rest } = input;
  const columns: Record<string, unknown> = { ...rest };

  if (weightGrams !== undefined) columns.weightGrams = weightGrams === null ? null : weightGrams.toFixed(3);
  if (price !== undefined) {
    const gross = price ?? 0;
    const net = gross / 1.15;
    columns.price = gross.toFixed(2);
    columns.priceNet = net.toFixed(2);
    columns.priceVat = (gross - net).toFixed(2);
  }
  if (input.category === 'Jewellery') columns.brand = null;
  return columns;
}

// Stock lookups are also needed at the till by people who can sell.
const canLookUpStock = checkAnyPermission(['stock', 'view'], ['sales', 'create']);

export function registerStockRoutes(app: Express) {

  app.get("/api/stock/metadata", authenticateToken, async (req, res) => {
    try {
      const meta = await db.select().from(settings).where(ilike(settings.key, 'stock_%'));
      const guarantee = await db.select().from(settings).where(eq(settings.key, 'guarantee_options')).limit(1);
      res.json([...meta, ...guarantee]);
    } catch (error) {
      sendError(res, error, "Failed to fetch stock metadata");
    }
  });

  app.get("/api/stock", authenticateToken, checkPermission('stock', 'view'), async (req, res) => {
    try {
      const items = await db.select().from(stock).where(eq(stock.status, 'Disponible'));
      res.json(items);
    } catch (error) {
      sendError(res, error, "Failed to fetch stock");
    }
  });

  app.get("/api/stock/sold", authenticateToken, checkAnyPermission(['stock', 'view'], ['reports', 'view']), async (req, res) => {
    try {
      const items = await db.select({
        id: stock.id,
        barcode: stock.barcode,
        category: stock.category,
        subCategory: stock.subCategory,
        metalType: stock.metalType,
        weightGrams: stock.weightGrams,
        soldAt: stock.soldAt,
        customerName: customers.name,
        price: sales.amount
      })
      .from(stock)
      .leftJoin(sales, eq(stock.id, sales.stockId))
      .leftJoin(customers, eq(sales.customerId, customers.id))
      .where(eq(stock.status, 'Vendu'))
      .orderBy(sql`${stock.soldAt} DESC`);
      res.json(items);
    } catch (error) {
      sendError(res, error, "Failed to fetch sold items");
    }
  });

  app.get("/api/stock/autocomplete", authenticateToken, canLookUpStock, async (req, res) => {
    const { q } = req.query;
    try {
      let queryBuilder;
      if (typeof q === 'string' && q.trim().length >= 2) {
        const searchStr = `%${escapeLike(q.trim())}%`;
        queryBuilder = db.select().from(stock).where(
          and(
            eq(stock.status, 'Disponible'),
            or(
              ilike(stock.barcode, searchStr),
              ilike(stock.itemCode, searchStr),
              ilike(stock.category, searchStr),
              ilike(stock.subCategory, searchStr),
              ilike(stock.brand, searchStr),
              ilike(stock.metalType, searchStr),
              ilike(stock.fineness, searchStr),
              ilike(stock.serialNumber, searchStr)
            )
          )
        );
      } else {
        queryBuilder = db.select().from(stock).where(eq(stock.status, 'Disponible'));
      }

      const results = await queryBuilder
        .orderBy(sql`${stock.createdAt} DESC`)
        .limit(20);
      res.json(results);
    } catch (error) {
      sendError(res, error, "Failed to search stock");
    }
  });

  app.get("/api/stock/:barcode", authenticateToken, canLookUpStock, async (req, res) => {
    try {
      const item = await db.select().from(stock)
        .where(and(eq(stock.barcode, req.params.barcode), eq(stock.status, 'Disponible')))
        .limit(1);
      if (item.length === 0) return res.status(404).json({ error: "Stock item not found or already sold" });
      res.json(item[0]);
    } catch (error) {
      sendError(res, error, "Failed to fetch stock item");
    }
  });

  app.post("/api/stock", authenticateToken, checkPermission('stock', 'create'), async (req, res) => {
    try {
      const { quantity, ...input } = stockCreateSchema.parse(req.body);
      const base = toStockColumns(input);

      if (quantity === 1) {
        const [newItem] = await db.insert(stock).values(base).returning();
        return res.status(201).json(newItem);
      }

      // Several identical pieces: one row each, with "-1", "-2"... suffixes.
      const results = await db.transaction(async (tx: any) => {
        const items = [];
        for (let i = 1; i <= quantity; i++) {
          const [newItem] = await tx.insert(stock).values({
            ...base,
            barcode: `${input.barcode}-${i}`,
            itemCode: input.itemCode ? `${input.itemCode}-${i}` : null,
          }).returning();
          items.push(newItem);
        }
        return items;
      });

      res.status(201).json({ items: results, count: results.length });
    } catch (error: any) {
      if (error.code === '23505') {
        return res.status(400).json({ error: "Un ou plusieurs codes-barres existent déjà.", message: "Un ou plusieurs codes-barres existent déjà." });
      }
      sendError(res, error, "Failed to create stock item", "Stock Create Error");
    }
  });

  // Bulk edit — update all remaining (unsold) items sharing the same base item code
  app.put("/api/stock/bulk-edit", authenticateToken, checkPermission('stock', 'edit'), async (req, res) => {
    try {
      const { baseItemCode, ...input } = stockBulkEditSchema.parse(req.body);
      const columns = toStockColumns(input);
      if (Object.keys(columns).length === 0) throw badRequest("Aucun champ à modifier.");

      const updated = await db.update(stock)
        .set({ ...columns, updatedAt: new Date() })
        .where(
          and(
            like(stock.itemCode, `${escapeLike(baseItemCode)}-%`),
            eq(stock.status, 'Disponible')
          )
        )
        .returning();

      res.json({ updated: updated.length, items: updated });
    } catch (error) {
      sendError(res, error, "Failed to bulk edit stock items", "Bulk Edit Error");
    }
  });

  app.put("/api/stock/:id", authenticateToken, checkPermission('stock', 'edit'), async (req, res) => {
    try {
      const stockId = idParam.parse(req.params.id);
      const columns = toStockColumns(stockUpdateSchema.parse(req.body));

      const [updated] = await db.update(stock)
        .set({ ...columns, updatedAt: new Date() })
        .where(eq(stock.id, stockId))
        .returning();
      if (!updated) throw notFound("Stock item not found");
      res.json(updated);
    } catch (error: any) {
      if (error.code === '23505') return res.status(400).json({ error: "Ce code-barres existe déjà." });
      sendError(res, error, "Failed to update stock item", "Stock Update Error");
    }
  });

  app.delete("/api/stock/:id", authenticateToken, checkPermission('stock', 'delete'), async (req, res) => {
    try {
      const stockId = idParam.parse(req.params.id);
      const [item] = await db.select().from(stock).where(eq(stock.id, stockId)).limit(1);
      if (!item) throw notFound("Stock item not found");
      // Sold items are part of the sales record and the Assay Office register.
      if (item.status !== 'Disponible') throw badRequest("Un article vendu ne peut pas être supprimé.");
      await db.delete(stock).where(eq(stock.id, stockId));
      res.json({ message: "Stock item deleted successfully" });
    } catch (error) {
      sendError(res, error, "Failed to delete stock item");
    }
  });
}
