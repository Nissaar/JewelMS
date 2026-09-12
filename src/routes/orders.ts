import type { Express } from "express";
import { db } from "../db/index";
import { customers, orders, sales } from "../db/schema";
import { eq, and, sql } from "drizzle-orm";
import { authenticateToken, checkPermission } from "../middleware/auth";
import { notFound, statusFor } from "../lib/errors";

export function registerOrdersRoutes(app: Express) {

  // --- Orders Endpoints ---
  app.get("/api/orders", authenticateToken, async (req, res) => {
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
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });


  app.post("/api/orders", authenticateToken, checkPermission('orders', 'create'), async (req, res) => {
    const { customerId, itemDescription, createdAt, estimatedWeight, estimatedPrice, deposit } = req.body;
    try {
      const newOrder = await db.insert(orders).values({
        customerId: parseInt(customerId),
        itemDescription,
        estimatedWeight,
        estimatedPrice,
        deposit,
        status: 'Pending',
        createdAt: createdAt ? new Date(createdAt) : new Date()
      }).returning();
      res.status(201).json({
        id: newOrder[0].id,
        ...newOrder[0]
      });
    } catch (error) {
      console.error("Order Creation Error:", error);
      res.status(500).json({ error: "Failed to create order" });
    }
  });


  app.get("/api/orders/:id/pdf", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const oId = parseInt(id);

      const { generateBookingReceiptPDF } = await import("../services/pdfService");
      const { doc } = await generateBookingReceiptPDF(oId);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename=booking-${id}.pdf`);
      
      doc.pipe(res);
      doc.end();
    } catch (error: any) {
      console.error("Booking PDF Generation Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate PDF" });
    }
  });


  app.post("/api/orders/:id/finalize", authenticateToken, checkPermission('orders', 'edit'), async (req: any, res) => {
    const { finalWeight, finalPrice, paymentMode } = req.body;
    const orderId = parseInt(req.params.id);

    try {
      await db.transaction(async (tx: any) => {
        const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
        if (!order) throw notFound("Order not found");

        await tx.update(orders)
          .set({ status: 'Finalized', finalWeight, finalPrice, updatedAt: new Date() })
          .where(eq(orders.id, orderId));

        const totalAmount = Number(finalPrice) || 0;
        const vat = totalAmount * 0.15;

        const newSale = await tx.insert(sales).values({
          customerId: order.customerId,
          stockId: null,
          orderId: order.id,
          amount: totalAmount.toString(),
          vat15: vat.toFixed(2),
          weight: (finalWeight && finalWeight !== "") ? finalWeight.toString() : null,
          paymentMode,
          itemDetails: `Finalized Order #${order.orderNumber}: ${order.itemDescription}`,
          qty: 1,
          unitSalesPrice: totalAmount.toString(),
          datetime: new Date()
        }).returning({ id: sales.id });

        res.json({ message: "Order finalized and sale created", saleId: newSale[0].id });
      });
    } catch (error) {
      if (statusFor(error) === 500) console.error("Order Finalization Error:", error);
      res.status(statusFor(error)).json({ error: error.message || "Failed to finalize order" });
    }
  });


  app.delete("/api/orders/:id", authenticateToken, checkPermission('orders', 'delete'), async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      await db.delete(orders).where(eq(orders.id, orderId));
      res.json({ success: true, message: "Commande supprimée avec succès" });
    } catch (error) {
      console.error("Delete Order Error:", error);
      res.status(500).json({ error: "Failed to delete order" });
    }
  });
}
