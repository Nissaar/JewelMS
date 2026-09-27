import type { Express } from "express";
import { db } from "../db/index";
import { stock, customers, receipts, orders, sales, odf } from "../db/schema";
import { eq, or, ilike, sql } from "drizzle-orm";
import { authenticateToken, checkAnyPermission, checkPermission } from "../middleware/auth";
import { customerCreateSchema, customerUpdateSchema, idParam } from "../lib/schemas";
import { notFound, sendError } from "../lib/errors";
import { escapeLike } from "../lib/sql";
import { saleBarcodes } from "../services/reportData";

export function registerCustomersRoutes(app: Express) {

  // Selling, orders and trade-ins all need to find or register the customer.
  const canFindCustomers = checkAnyPermission(['customers', 'view'], ['sales', 'create'], ['orders', 'create'], ['odf', 'create']);
  const canRegisterCustomers = checkAnyPermission(['customers', 'create'], ['sales', 'create'], ['orders', 'create'], ['odf', 'create']);

  app.get("/api/customers", authenticateToken, canFindCustomers, async (req, res) => {
    const { search } = req.query;
    try {
      if (typeof search === 'string' && search.trim()) {
        const searchStr = `%${escapeLike(search.trim())}%`;
        const results = await db.select().from(customers).where(
          or(
            ilike(customers.name, searchStr),
            ilike(customers.idNumber, searchStr)
          )
        );
        return res.json(results);
      }
      res.json(await db.select().from(customers));
    } catch (error) {
      sendError(res, error, "Failed to fetch customers");
    }
  });

  app.post("/api/customers", authenticateToken, canRegisterCustomers, async (req, res) => {
    try {
      const input = customerCreateSchema.parse(req.body);
      const [newCustomer] = await db.insert(customers).values(input).returning();
      res.status(201).json(newCustomer);
    } catch (error: any) {
      if (error.code === '23505') {
        return res.status(400).json({ error: "Ce client existe déjà.", message: "Ce client existe déjà." });
      }
      sendError(res, error, "Failed to create customer profile", "Customer Create Error");
    }
  });

  app.put("/api/customers/:id", authenticateToken, checkPermission('customers', 'edit'), async (req, res) => {
    try {
      const customerId = idParam.parse(req.params.id);
      const input = customerUpdateSchema.parse(req.body);
      const [updated] = await db.update(customers)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(customers.id, customerId))
        .returning();
      if (!updated) throw notFound("Customer not found");
      res.json(updated);
    } catch (error: any) {
      if (error.code === '23505') {
        return res.status(400).json({ error: "Ce numéro d'identité est déjà utilisé.", message: "Ce numéro d'identité est déjà utilisé." });
      }
      sendError(res, error, "Failed to update customer", "Customer Update Error");
    }
  });


  app.get("/api/customers/:id/history", authenticateToken, checkPermission('customers', 'view'), async (req, res) => {
    try {
      const customerId = idParam.parse(req.params.id);
      const [customerReceipts, customerOrders, customerOdfs] = await Promise.all([
        db.select({
          id: sales.id,
          receiptId: receipts.id,
          receiptNo: receipts.receiptSerialNumber,
          date: sales.datetime,
          amount: sales.amount,
          itemDetails: sales.itemDetails,
          barcode: saleBarcodes,
          status: sales.status,
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
      sendError(res, error, "Failed to fetch customer history", "Customer History Error");
    }
  });

}
