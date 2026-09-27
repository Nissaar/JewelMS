import type { Express } from "express";
import { db } from "../db/index";
import { stock, customers, receipts, sales } from "../db/schema";
import { eq } from "drizzle-orm";
import { authenticateToken, checkPermission } from "../middleware/auth";
import { idParam, sendMethodSchema } from "../lib/schemas";
import { notFound, sendError } from "../lib/errors";
import { assertCanSend, deliverDocument } from "../services/notifications";
import { ensureReceiptFile } from "../services/documents";
import { contentTypeFor, readFile, verifyFileToken } from "../services/storage";

export function registerReceiptsRoutes(app: Express) {

  // Every call is a counted print, so reprints carry the COPIE watermark.
  app.get("/api/receipts/:saleId/pdf", authenticateToken, checkPermission('sales', 'view'), async (req, res) => {
    try {
      const saleId = idParam.parse(req.params.saleId);
      const { generateReceiptPDF } = await import("../services/pdf");
      const { doc } = await generateReceiptPDF(saleId);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="receipt-${saleId}.pdf"`);
      doc.pipe(res);
      doc.end();
    } catch (error) {
      sendError(res, error, "Failed to generate PDF", "PDF Generation Error");
    }
  });

  app.get("/api/receipts/:saleId/declaration-pdf", authenticateToken, checkPermission('sales', 'view'), async (req, res) => {
    try {
      const saleId = idParam.parse(req.params.saleId);
      const { generateDeclarationPDF } = await import("../services/pdf");
      const { buffer } = await generateDeclarationPDF(saleId);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="tradein-declaration-${saleId}.pdf"`);
      res.send(buffer);
    } catch (error) {
      sendError(res, error, "Failed to generate trade-in declaration PDF", "Declaration PDF Generation Error");
    }
  });

  app.post("/api/receipts/:saleId/send", authenticateToken, checkPermission('sales', 'create'), async (req, res) => {
    try {
      const saleId = idParam.parse(req.params.saleId);
      const { method } = sendMethodSchema.parse(req.body);

      const [sale] = await db.select().from(sales).where(eq(sales.id, saleId)).limit(1);
      if (!sale) throw notFound("Sale not found");
      const [customer] = sale.customerId
        ? await db.select().from(customers).where(eq(customers.id, sale.customerId)).limit(1)
        : [];
      assertCanSend(method, customer);

      // Generate the stored copy now so a PDF failure is reported to the caller.
      await ensureReceiptFile(saleId);

      res.json({
        success: true,
        message: "Demande reçue. L'envoi est en cours d'exécution en arrière-plan.",
        results: { queued: true },
      });
      setImmediate(() => deliverDocument('receipt', saleId, method, customer));
    } catch (error) {
      sendError(res, error, "Failed to send receipt", "Send Receipt Error");
    }
  });

  app.get("/api/receipts", authenticateToken, checkPermission('sales', 'view'), async (req, res) => {
    try {
      const allReceipts = await db.select({
        id: receipts.id,
        saleId: receipts.saleId,
        receiptNo: receipts.receiptSerialNumber,
        createdAt: receipts.createdAt,
        customerName: customers.name,
        totalAmount: sales.amount,
        barcode: stock.barcode,
        itemDetails: sales.itemDetails
      })
      .from(receipts)
      .innerJoin(sales, eq(receipts.saleId, sales.id))
      .leftJoin(customers, eq(sales.customerId, customers.id))
      .leftJoin(stock, eq(sales.stockId, stock.id))
      .orderBy(receipts.createdAt);

      res.json(allReceipts);
    } catch (error) {
      sendError(res, error, "Failed to fetch receipts");
    }
  });

  // Signed, expiring link used by WhatsApp to fetch a document. No login:
  // the token itself is the authorisation.
  app.get("/api/files/:token", async (req, res) => {
    try {
      const { kind, name } = verifyFileToken(req.params.token);
      const data = await readFile(kind, name);
      res.setHeader('Content-Type', contentTypeFor(name));
      res.setHeader('Content-Disposition', `inline; filename="${name}"`);
      res.setHeader('Cache-Control', 'private, no-store');
      res.send(data);
    } catch (error) {
      sendError(res, error, "File not available");
    }
  });
}
