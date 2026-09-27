import type { Express } from "express";
import { db } from "../db/index";
import { customers, orders, sales } from "../db/schema";
import { eq, and, sql } from "drizzle-orm";
import { authenticateToken, checkPermission } from "../middleware/auth";
import { notFound, sendError } from "../lib/errors";
import { idParam, orderCreateSchema, orderFinalizeSchema } from "../lib/schemas";

export function registerOrdersRoutes(app: Express) {

  // --- Orders Endpoints ---
  app.get("/api/orders", authenticateToken, checkPermission('orders', 'view'), async (req, res) => {
    try {
      const allOrders = await db.select({
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
      .orderBy(sql`${orders.createdAt} DESC`);
      res.json(allOrders);
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


  app.post("/api/orders/:id/finalize", authenticateToken, checkPermission('orders', 'edit'), async (req: any, res) => {
    try {
      const orderId = idParam.parse(req.params.id);
      const { finalWeight, finalPrice, paymentMode } = orderFinalizeSchema.parse(req.body);

      await db.transaction(async (tx: any) => {
        const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
        if (!order) throw notFound("Order not found");

        await tx.update(orders)
          .set({ status: 'Finalized', finalWeight: finalWeight?.toFixed(3) ?? null, finalPrice: finalPrice!.toFixed(2), updatedAt: new Date() })
          .where(eq(orders.id, orderId));

        const totalAmount = Number(finalPrice) || 0;
        const vat = totalAmount * 0.15;

        const newSale = await tx.insert(sales).values({
          customerId: order.customerId,
          stockId: null,
          orderId: order.id,
          amount: totalAmount.toString(),
          vat15: vat.toFixed(2),
          weight: finalWeight?.toFixed(3) ?? null,
          paymentMode,
          itemDetails: `Finalized Order #${order.orderNumber}: ${order.itemDescription}`,
          qty: 1,
          unitSalesPrice: totalAmount.toString(),
          datetime: new Date()
        }).returning({ id: sales.id });

        res.json({ message: "Order finalized and sale created", saleId: newSale[0].id });
      });
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
