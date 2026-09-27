import type { Express } from "express";
import { db } from "../db/index";
import { customers, orders, receipts, saleItems, sales } from "../db/schema";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { authenticateToken, checkPermission, type AuthRequest } from "../middleware/auth";
import { badRequest, notFound, sendError } from "../lib/errors";
import { containsPattern, queryText } from "../lib/query";
import { listResponse } from "../lib/pagination";
import { centsToDecimal, splitGross, toCents } from "../shared/money";
import { idParam, orderCreateSchema, orderFinalizeSchema } from "../lib/schemas";

export function registerOrdersRoutes(app: Express) {

  // --- Orders Endpoints ---
  // Newest first. ?q= matches customer or description; ?status=Pending|Finalized filters.
  app.get("/api/orders", authenticateToken, checkPermission('orders', 'view'), async (req, res) => {
    try {
      const q = queryText(req.query.q);
      const status = queryText(req.query.status);
      const pattern = containsPattern(q);
      const where = and(
        status ? eq(orders.status, status) : undefined,
        q ? or(ilike(customers.name, pattern), ilike(orders.itemDescription, pattern), sql`CAST(${orders.orderNumber} AS TEXT) = ${q}`) : undefined,
      );
      const base = () => db.select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        customerId: orders.customerId,
        customerName: customers.name,
        itemDescription: orders.itemDescription,
        status: orders.status,
        finalWeight: orders.finalWeight,
        finalPrice: orders.finalPrice,
        deposit: orders.deposit,
        estimatedWeight: orders.estimatedWeight,
        estimatedPrice: orders.estimatedPrice,
        createdAt: orders.createdAt
      })
      .from(orders)
      .innerJoin(customers, eq(orders.customerId, customers.id))
      .where(where)
      .orderBy(sql`${orders.createdAt} DESC`, desc(orders.id))
      .$dynamic();

      res.json(await listResponse(req.query,
        (limit, offset) => (limit ? base().limit(limit).offset(offset!) : base()),
        async () => (await db.select({ n: sql<number>`count(*)::int` }).from(orders)
          .innerJoin(customers, eq(orders.customerId, customers.id)).where(where))[0].n,
      ));
    } catch (error) {
      sendError(res, error, "Failed to fetch orders");
    }
  });


  app.post("/api/orders", authenticateToken, checkPermission('orders', 'create'), async (req, res) => {
    try {
      const input = orderCreateSchema.parse(req.body);
      const newOrder = await db.insert(orders).values({
        customerId: input.customerId,
        itemDescription: input.itemDescription,
        estimatedWeight: input.estimatedWeight?.toFixed(3) ?? null,
        estimatedPrice: input.estimatedPrice?.toFixed(2) ?? null,
        deposit: input.deposit?.toFixed(2) ?? null,
        status: 'Pending',
        createdAt: input.createdAt ?? new Date()
      }).returning();
      res.status(201).json({
        id: newOrder[0].id,
        ...newOrder[0]
      });
    } catch (error) {
      sendError(res, error, "Failed to create order", "Order Creation Error");
    }
  });


  app.get("/api/orders/:id/pdf", authenticateToken, checkPermission('orders', 'view'), async (req, res) => {
    try {
      const oId = idParam.parse(req.params.id);

      const { generateBookingReceiptPDF } = await import("../services/pdf");
      const { doc } = await generateBookingReceiptPDF(oId);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="booking-${oId}.pdf"`);
      
      doc.pipe(res);
      doc.end();
    } catch (error) {
      sendError(res, error, "Failed to generate PDF", "Booking PDF Generation Error");
    }
  });


  app.post("/api/orders/:id/finalize", authenticateToken, checkPermission('orders', 'edit'), async (req: AuthRequest, res) => {
    try {
      const orderId = idParam.parse(req.params.id);
      const { finalWeight, finalPrice, paymentMode } = orderFinalizeSchema.parse(req.body);

      const saleId = await db.transaction(async (tx) => {
        // Lock the order so a double-click can't finalize it twice.
        const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1).for('update');
        if (!order) throw notFound("Order not found");
        if (order.status !== 'Pending') throw badRequest("Cette commande est déjà finalisée.");

        // The final price is entered VAT-inclusive ("Prix TTC Total").
        const { netCents, vatCents } = splitGross(toCents(finalPrice));

        await tx.update(orders)
          .set({ status: 'Finalized', finalWeight: finalWeight?.toFixed(3) ?? null, finalPrice: centsToDecimal(toCents(finalPrice)), updatedAt: new Date() })
          .where(eq(orders.id, orderId));

        const [newSale] = await tx.insert(sales).values({
          customerId: order.customerId,
          stockId: null,
          orderId: order.id,
          amount: centsToDecimal(netCents),
          vat15: centsToDecimal(vatCents),
          weight: finalWeight?.toFixed(3) ?? null,
          paymentMode,
          itemDetails: `Finalized Order #${order.orderNumber}: ${order.itemDescription}`,
          qty: 1,
          unitSalesPrice: centsToDecimal(netCents),
          datetime: new Date()
        }).returning({ id: sales.id });
        await tx.insert(saleItems).values({
          saleId: newSale.id,
          itemDetails: `Commande #${order.orderNumber}: ${order.itemDescription || ''}`.trim(),
          qty: 1,
          unitSalesPrice: centsToDecimal(netCents),
          amount: centsToDecimal(netCents),
          vat15: centsToDecimal(vatCents),
          weight: finalWeight?.toFixed(3) ?? null,
        });
        await tx.insert(receipts).values({ saleId: newSale.id });
        return newSale.id;
      });

      // Reply only once the transaction has committed.
      res.json({ message: "Order finalized and sale created", saleId });
    } catch (error) {
      sendError(res, error, "Failed to finalize order", "Order Finalization Error");
    }
  });


  app.delete("/api/orders/:id", authenticateToken, checkPermission('orders', 'delete'), async (req, res) => {
    try {
      const orderId = idParam.parse(req.params.id);
      const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      await db.delete(orders).where(eq(orders.id, orderId));
      res.json({ success: true, message: "Commande supprimée avec succès" });
    } catch (error) {
      sendError(res, error, "Failed to delete order", "Delete Order Error");
    }
  });
}
