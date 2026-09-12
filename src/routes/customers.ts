import type { Express } from "express";
import { db } from "../db/index";
import { stock, customers, receipts, orders, sales, odf } from "../db/schema";
import { eq, or, ilike, sql } from "drizzle-orm";
import { authenticateToken, checkPermission } from "../middleware/auth";

export function registerCustomersRoutes(app: Express) {

  // --- KYC / Customer Endpoints ---
  app.get("/api/customers", authenticateToken, checkPermission('customers', 'view'), async (req, res) => {
    const { search } = req.query;
    try {
      let query = db.select().from(customers);
      if (search) {
        const searchStr = `%${search}%`;
        // Use a conditional or if search is provided
        // Drizzle ilike needs to be handled
        const results = await db.select().from(customers).where(
          or(
            ilike(customers.name, searchStr),
            ilike(customers.idNumber, searchStr)
          )
        );
        return res.json(results);
      }
      const allCustomers = await query;
      res.json(allCustomers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });


  app.post("/api/customers", authenticateToken, checkPermission('customers', 'create'), async (req, res) => {
    try {
      const data = { ...req.body };
      // Map empty or whitespace-only optional fields to null
      if (data.idNumber === undefined || data.idNumber === null || String(data.idNumber).trim() === '') {
        data.idNumber = null;
      }
      if (data.email === undefined || data.email === null || String(data.email).trim() === '') {
        data.email = null;
      }
      if (data.address === undefined || data.address === null || String(data.address).trim() === '') {
        data.address = null;
      }
      if (data.phoneNumber === undefined || data.phoneNumber === null || String(data.phoneNumber).trim() === '') {
        data.phoneNumber = null;
      }

      const newCustomer = await db.insert(customers).values(data).returning();
      res.status(201).json(newCustomer[0]);
    } catch (error: any) {
      if (error.code === '23505') {
        return res.status(400).json({ message: "Ce client existe déjà." });
      }
      res.status(500).json({ error: "Failed to create customer profile" });
    }
  });


  app.put("/api/customers/:id", authenticateToken, checkPermission('customers', 'edit'), async (req, res) => {
    try {
      const data = { ...req.body };
      // Map empty or whitespace-only optional fields to null
      if (data.idNumber === undefined || data.idNumber === null || String(data.idNumber).trim() === '') {
        data.idNumber = null;
      }
      if (data.email === undefined || data.email === null || String(data.email).trim() === '') {
        data.email = null;
      }
      if (data.address === undefined || data.address === null || String(data.address).trim() === '') {
        data.address = null;
      }
      if (data.phoneNumber === undefined || data.phoneNumber === null || String(data.phoneNumber).trim() === '') {
        data.phoneNumber = null;
      }

      const updated = await db.update(customers)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(customers.id, parseInt(req.params.id)))
        .returning();
      if (updated.length === 0) return res.status(404).json({ error: "Customer not found" });
      res.json(updated[0]);
    } catch (error) {
      res.status(500).json({ error: "Failed to update customer" });
    }
  });


  app.get("/api/customers/:id/history", authenticateToken, checkPermission('customers', 'view'), async (req, res) => {
    const customerId = parseInt(req.params.id);
    try {
      const [customerReceipts, customerOrders, customerOdfs] = await Promise.all([
        db.select({
          id: sales.id,
          receiptId: receipts.id,
          receiptNo: receipts.receiptSerialNumber,
          date: sales.datetime,
          amount: sales.amount,
          itemDetails: sales.itemDetails,
          barcode: stock.barcode,
          category: stock.category,
          subCategory: stock.subCategory,
          fileUrl: receipts.fileUrl
        })
        .from(sales)
        .leftJoin(receipts, eq(sales.id, receipts.saleId))
        .leftJoin(stock, eq(sales.stockId, stock.id))
        .where(eq(sales.customerId, customerId))
        .orderBy(sql`${sales.datetime} DESC`),

        db.select()
        .from(orders)
        .where(eq(orders.customerId, customerId)),

        db.select()
        .from(odf)
        .where(eq(odf.customerId, customerId))
      ]);

      res.json({
        receipts: customerReceipts,
        orders: customerOrders,
        odf: customerOdfs
      });
    } catch (error) {
      console.error("Customer History Error:", error);
      res.status(500).json({ error: "Failed to fetch customer history" });
    }
  });

  // --- Search & Reporting Endpoints ---
}
