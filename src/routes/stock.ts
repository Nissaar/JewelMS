import type { Express } from "express";
import { db } from "../db/index";
import { settings, stock, customers, sales } from "../db/schema";
import { eq, or, ilike, like, and, sql } from "drizzle-orm";
import { authenticateToken, checkPermission } from "../middleware/auth";

export function registerStockRoutes(app: Express) {

  // --- Stock Endpoints ---
  app.get("/api/stock/metadata", authenticateToken, async (req, res) => {
    try {
      const meta = await db.select().from(settings).where(ilike(settings.key, 'stock_%'));
      const guarantee = await db.select().from(settings).where(eq(settings.key, 'guarantee_options')).limit(1);
      res.json([...meta, ...guarantee]);
    } catch (error) {
      console.error("Stock Metadata Error:", error);
      res.status(500).json({ error: "Failed to fetch stock metadata" });
    }
  });


  app.get("/api/stock", authenticateToken, checkPermission('stock', 'view'), async (req, res) => {
    try {
      const items = await db.select().from(stock).where(eq(stock.status, 'Disponible'));
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stock" });
    }
  });


  app.get("/api/stock/sold", authenticateToken, checkPermission('reports', 'view'), async (req, res) => {
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
      console.error("Sold Stock Error:", error);
      res.status(500).json({ error: "Failed to fetch sold items" });
    }
  });


  app.get("/api/stock/autocomplete", authenticateToken, async (req, res) => {
    const { q } = req.query;
    
    try {
      let queryBuilder;
      
      if (q && typeof q === 'string' && q.trim().length >= 2) {
        const searchStr = `%${q}%`;
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
      console.error("Autocomplete Error:", error);
      res.status(500).json({ error: "Failed to search stock" });
    }
  });


  app.get("/api/stock/:barcode", authenticateToken, checkPermission('stock', 'view'), async (req, res) => {
    try {
      const item = await db.select().from(stock)
        .where(and(eq(stock.barcode, req.params.barcode), eq(stock.status, 'Disponible')))
        .limit(1);
      if (item.length === 0) return res.status(404).json({ error: "Stock item not found or already sold" });
      res.json(item[0]);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stock item" });
    }
  });


  app.post("/api/stock", authenticateToken, checkPermission('stock', 'create'), async (req, res) => {
    try {
      const { quantity: rawQuantity, ...basePayload } = req.body;
      const quantity = Math.min(Math.max(parseInt(rawQuantity) || 1, 1), 100);

      // Helper to sanitize a single payload
      const sanitizePayload = (payload: any) => {
        if (payload.category === 'Jewellery') {
          payload.brand = null;
        }
        if (payload.weightGrams === "") payload.weightGrams = null;
        if (payload.yearsOfGuarantee === "") payload.yearsOfGuarantee = null;
        if (payload.fineness === "") payload.fineness = null;
        if (payload.price === "" || payload.price === undefined || payload.price === null) {
          payload.price = "0.00";
          payload.priceNet = "0.00";
          payload.priceVat = "0.00";
        } else {
          const priceNum = parseFloat(payload.price);
          const priceNet = priceNum / 1.15;
          const priceVat = priceNum - priceNet;
          payload.priceNet = priceNet.toFixed(2);
          payload.priceVat = priceVat.toFixed(2);
          payload.price = priceNum.toFixed(2);
        }
        return payload;
      };

      if (quantity === 1) {
        // Single insert — same as original behavior, no suffix
        const payload = sanitizePayload({ ...basePayload });
        const newItem = await db.insert(stock).values(payload).returning();
        return res.status(201).json(newItem[0]);
      }

      // Bulk insert with transaction
      const results = await db.transaction(async (tx) => {
        const items = [];
        for (let i = 1; i <= quantity; i++) {
          const suffix = `-${i}`;
          const payload = sanitizePayload({
            ...basePayload,
            barcode: `${basePayload.barcode}${suffix}`,
            itemCode: basePayload.itemCode ? `${basePayload.itemCode}${suffix}` : null,
          });
          const [newItem] = await tx.insert(stock).values(payload).returning();
          items.push(newItem);
        }
        return items;
      });

      res.status(201).json({ items: results, count: results.length });
    } catch (error: any) {
      if (error.code === '23505') {
        return res.status(400).json({ message: "Un ou plusieurs codes-barres existent déjà." });
      }
      console.error("Stock Create Error:", error);
      res.status(500).json({ error: "Failed to create stock item" });
    }
  });

  // Bulk edit — update all remaining (unsold) items sharing the same base item code


  // Bulk edit — update all remaining (unsold) items sharing the same base item code
  app.put("/api/stock/bulk-edit", authenticateToken, checkPermission('stock', 'edit'), async (req, res) => {
    try {
      const { baseItemCode, ...updateFields } = req.body;
      if (!baseItemCode) {
        return res.status(400).json({ message: "baseItemCode est requis." });
      }

      // Remove fields that should stay unique per item
      delete updateFields.barcode;
      delete updateFields.itemCode;
      delete updateFields.id;

      // Sanitize numeric fields
      if (updateFields.weightGrams === "") updateFields.weightGrams = null;
      if (updateFields.yearsOfGuarantee === "") updateFields.yearsOfGuarantee = null;
      if (updateFields.fineness === "") updateFields.fineness = null;
      if (updateFields.category === 'Jewellery') {
        updateFields.brand = null;
      }
      if (updateFields.price === "" || updateFields.price === undefined || updateFields.price === null) {
        updateFields.price = "0.00";
        updateFields.priceNet = "0.00";
        updateFields.priceVat = "0.00";
      } else if (updateFields.price !== undefined) {
        const priceNum = parseFloat(updateFields.price);
        const priceNet = priceNum / 1.15;
        const priceVat = priceNum - priceNet;
        updateFields.priceNet = priceNet.toFixed(2);
        updateFields.priceVat = priceVat.toFixed(2);
        updateFields.price = priceNum.toFixed(2);
      }

      // Match items whose itemCode starts with the base code followed by a dash
      const pattern = `${baseItemCode}-%`;
      const updated = await db.update(stock)
        .set({ ...updateFields, updatedAt: new Date() })
        .where(
          and(
            like(stock.itemCode, pattern),
            eq(stock.status, 'Disponible')
          )
        )
        .returning();

      res.json({ updated: updated.length, items: updated });
    } catch (error) {
      console.error("Bulk Edit Error:", error);
      res.status(500).json({ error: "Failed to bulk edit stock items" });
    }
  });


  app.put("/api/stock/:id", authenticateToken, checkPermission('stock', 'edit'), async (req, res) => {
    try {
      const payload = { ...req.body };
      // Sanitize brand for Jewellery
      if (payload.category === 'Jewellery') {
        payload.brand = null;
      }
      // Sanitize numeric fields that might be empty strings from frontend
      if (payload.weightGrams === "") payload.weightGrams = null;
      if (payload.yearsOfGuarantee === "") payload.yearsOfGuarantee = null;
      if (payload.fineness === "") payload.fineness = null;
      if (payload.price === "" || payload.price === undefined || payload.price === null) {
        payload.price = "0.00";
        payload.priceNet = "0.00";
        payload.priceVat = "0.00";
      } else {
        const priceNum = parseFloat(payload.price);
        const priceNet = priceNum / 1.15;
        const priceVat = priceNum - priceNet;
        payload.priceNet = priceNet.toFixed(2);
        payload.priceVat = priceVat.toFixed(2);
        payload.price = priceNum.toFixed(2);
      }

      const updated = await db.update(stock)
        .set({ ...payload, updatedAt: new Date() })
        .where(eq(stock.id, parseInt(req.params.id)))
        .returning();
      if (updated.length === 0) return res.status(404).json({ error: "Stock item not found" });
      res.json(updated[0]);
    } catch (error) {
      res.status(500).json({ error: "Failed to update stock item" });
    }
  });


  app.delete("/api/stock/:id", authenticateToken, checkPermission('stock', 'delete'), async (req, res) => {
    try {
      await db.delete(stock).where(eq(stock.id, parseInt(req.params.id)));
      res.json({ message: "Stock item deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete stock item" });
    }
  });

  // --- KYC / Customer Endpoints ---
}
