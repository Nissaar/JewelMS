import type { Express } from "express";
import type { Multer } from "multer";
import { db } from "../db/index";
import { stock, customers, receipts, sales } from "../db/schema";
import { eq, or } from "drizzle-orm";
import { authenticateToken } from "../middleware/auth";
import { checkNotificationConfig } from "../lib/notifications";
import path from "path";

export function registerReceiptsRoutes(app: Express, upload: Multer) {


  // --- Receipt PDF Generation ---
  app.get("/api/receipts/:saleId/pdf", authenticateToken, async (req, res) => {
    try {
      const { saleId } = req.params;
      const sId = parseInt(saleId);

      // Try to fetch from storage first if it exists
      const receiptArr = await db.select().from(receipts).where(eq(receipts.saleId, sId)).limit(1);
      const receipt = receiptArr[0];

      if (receipt && receipt.fileUrl) {
        try {
          const { getReceiptFromStorage } = await import("../services/storageService");
          const fileName = path.basename(receipt.fileUrl);
          const buffer = await getReceiptFromStorage(fileName);
          
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `inline; filename=${fileName}`);
          return res.send(buffer);
        } catch (storageError) {
          console.warn("Local storage fetch failed, falling back to dynamic generation:", storageError);
        }
      }
      
      // Fallback to dynamic generation
      const { generateReceiptPDF } = await import("../services/pdfService");
      const { doc } = await generateReceiptPDF(sId);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename=receipt-${saleId}.pdf`);
      
      doc.pipe(res);
      doc.end();
    } catch (error: any) {
      console.error("PDF Generation Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate PDF" });
    }
  });

  // --- Trade-in Declaration PDF Generation ---


  // --- Trade-in Declaration PDF Generation ---
  app.get("/api/receipts/:saleId/declaration-pdf", authenticateToken, async (req, res) => {
    try {
      const { saleId } = req.params;
      const sId = parseInt(saleId);

      const { generateDeclarationPDF } = await import("../services/pdfService");
      const result = await generateDeclarationPDF(sId);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename=tradein-declaration-${saleId}.pdf`);
      
      if (result.buffer) {
        res.send(result.buffer);
      } else if (result.doc) {
        result.doc.pipe(res);
        result.doc.end();
      }
    } catch (error: any) {
      console.error("Declaration PDF Generation Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate trade-in declaration PDF" });
    }
  });

  // --- Dedicated ODF Declaration PDF Generation ---


  app.post("/api/receipts/:saleId/upload", authenticateToken, async (req, res) => {
    try {
      const { saleId } = req.params;
      const sId = parseInt(saleId);
      const { generateReceiptPDF, getPDFBuffer } = await import("../services/pdfService");
      const { uploadReceiptToStorage } = await import("../services/storageService");
      const { sanitize } = await import("../lib/utils");
      
      // 1. Generate PDF
      const { doc, receipt } = await generateReceiptPDF(sId);
      const buffer = await getPDFBuffer(doc);

      // Fetch info for dynamic naming
      const saleRec = await db.select({
        stock: stock,
        customer: customers
      })
      .from(sales)
      .leftJoin(stock, eq(sales.stockId, stock.id))
      .leftJoin(customers, eq(sales.customerId, customers.id))
      .where(eq(sales.id, sId))
      .limit(1);
      
      const category = saleRec[0]?.stock?.category || "Jewellery";
      const subCategory = saleRec[0]?.stock?.subCategory || "Item";
      const clientId = saleRec[0]?.customer?.idNumber || "Unknown";
      
      const fileName = `${sanitize(category)}_${sanitize(subCategory)}_${sanitize(clientId)}_${receipt.id}.pdf`;
      
      // 2. Save locally
      const fileUrl = await uploadReceiptToStorage(fileName, buffer);
      
      // 3. Save URL to receipts table
      await db.update(receipts)
        .set({ fileUrl })
        .where(eq(receipts.id, receipt.id));
        
      res.json({
        message: "Receipt saved locally successfully",
        file_url: fileUrl
      });
    } catch (error: any) {
      console.error("Receipt Upload Error:", error);
      res.status(500).json({ error: error.message || "Failed to save receipt" });
    }
  });


  app.post("/api/notifications/send-receipt", authenticateToken, async (req, res) => {
    const { saleId, method } = req.body;
    
    if (!checkNotificationConfig(method)) {
      return res.status(412).json({ 
        success: false, 
        error: 'CONFIGURATION_MISSING',
        message: 'WhatsApp or Email service is not configured on the server.'
      });
    }

    // Reuse existing logic
    try {
      const saleArr = await db.select().from(sales).where(eq(sales.id, parseInt(saleId))).limit(1);
      if (saleArr.length === 0) return res.status(404).json({ error: "Sale not found" });
      const sale = saleArr[0];

      const receiptArr = await db.select().from(receipts).where(eq(receipts.saleId, sale.id)).limit(1);
      let receipt = receiptArr[0];

      if (!receipt || !receipt.fileUrl) {
        const { generateReceiptPDF, getPDFBuffer } = await import("../services/pdfService");
        const { uploadReceiptToStorage } = await import("../services/storageService");
        const { sanitize } = await import("../lib/utils");
        
        const { doc, receipt: genReceipt } = await generateReceiptPDF(sale.id);
        const buffer = await getPDFBuffer(doc);
        const fileName = `receipt-${genReceipt.id}-${sanitize(genReceipt.receiptSerialNumber.toString())}.pdf`;
        const fileUrl = await uploadReceiptToStorage(fileName, buffer);
        
        await db.update(receipts)
          .set({ fileUrl })
          .where(eq(receipts.id, genReceipt.id));
          
        receipt = { ...genReceipt, fileUrl };
      }

      const customerArr = sale.customerId 
        ? await db.select().from(customers).where(eq(customers.id, sale.customerId)).limit(1)
        : [];
      const customer = customerArr[0];

      if (!customer) return res.status(404).json({ error: "Customer info required for sending receipt." });

      if ((method === 'email' || method === 'both') && !customer.email) {
        return res.status(400).json({ success: false, error: 'CLIENT_EMAIL_MISSING', message: "Le client n'a pas d'adresse email configurée." });
      }

      // Return success response immediately to prevent frontend timeout
      res.json({ 
        success: true, 
        message: "Demande reçue. L'envoi est en cours d'exécution en arrière-plan.",
        results: { queued: true } 
      });

      // Fire the asynchronous transmission in background
      setImmediate(async () => {
        try {
          const results: any = {};
          if (method === 'whatsapp' || method === 'both') {
            const { sendWhatsAppReceipt } = await import("../services/whatsappService");
            results.whatsapp = await sendWhatsAppReceipt(customer.phoneNumber || '', receipt.fileUrl, receipt.receiptSerialNumber.toString());
            console.log(`[Background Sender] WhatsApp for receipt ${receipt.receiptSerialNumber} sent successfully.`);
          }

          if (method === 'email' || method === 'both') {
            const { sendEmailReceipt } = await import("../services/emailService");
            results.email = await sendEmailReceipt(customer.email || '', customer.name, receipt.fileUrl, receipt.receiptSerialNumber.toString());
            console.log(`[Background Sender] Email for receipt ${receipt.receiptSerialNumber} sent successfully.`);
          }
        } catch (error: any) {
          console.error(`[Background Sender Error] Failed sending notifications for receipt/sale ID ${saleId}:`, error.message || error);
        }
      });

    } catch (error: any) {
      console.error("Send Notification Error:", error);
      res.status(500).json({ error: error.message || "Failed to send notification" });
    }
  });


  app.post("/api/receipts/:saleId/send", authenticateToken, async (req, res) => {
    const { saleId } = req.params;
    const { method } = req.body; // 'whatsapp', 'email', or 'both'

    if (!checkNotificationConfig(method)) {
      return res.status(412).json({ 
        success: false, 
        error: 'CONFIGURATION_MISSING',
        message: 'WhatsApp or Email service is not configured on the server.'
      });
    }

    try {
      const saleArr = await db.select().from(sales).where(eq(sales.id, parseInt(saleId))).limit(1);
      if (saleArr.length === 0) return res.status(404).json({ error: "Sale not found" });
      const sale = saleArr[0];

      const receiptArr = await db.select().from(receipts).where(eq(receipts.saleId, sale.id)).limit(1);
      let receipt = receiptArr[0];

      if (!receipt || !receipt.fileUrl) {
        const { generateReceiptPDF, getPDFBuffer } = await import("../services/pdfService");
        const { uploadReceiptToStorage } = await import("../services/storageService");
        const { sanitize } = await import("../lib/utils");
        
        const { doc, receipt: genReceipt } = await generateReceiptPDF(sale.id);
        const buffer = await getPDFBuffer(doc);
        const fileName = `receipt-${genReceipt.id}-${sanitize(genReceipt.receiptSerialNumber.toString())}.pdf`;
        const fileUrl = await uploadReceiptToStorage(fileName, buffer);
        
        await db.update(receipts)
          .set({ fileUrl })
          .where(eq(receipts.id, genReceipt.id));
          
        receipt = { ...genReceipt, fileUrl };
      }

      const customerArr = sale.customerId 
        ? await db.select().from(customers).where(eq(customers.id, sale.customerId)).limit(1)
        : [];
      const customer = customerArr[0];

      if (!customer) return res.status(404).json({ error: "Customer info required for sending receipt." });

      if ((method === 'email' || method === 'both') && !customer.email) {
        return res.status(400).json({ success: false, error: 'CLIENT_EMAIL_MISSING', message: "Le client n'a pas d'adresse email configurée." });
      }

      // Return success response immediately to prevent frontend timeout
      res.json({ 
        success: true, 
        message: "Demande reçue. L'envoi est en cours d'exécution en arrière-plan.",
        results: { queued: true } 
      });

      // Fire the asynchronous transmission in background
      setImmediate(async () => {
        try {
          const results: any = {};
          if (method === 'whatsapp' || method === 'both') {
            if (customer.phoneNumber) {
              const { sendWhatsAppReceipt } = await import("../services/whatsappService");
              results.whatsapp = await sendWhatsAppReceipt(customer.phoneNumber, receipt.fileUrl, receipt.receiptSerialNumber.toString());
              console.log(`[Background Sender] WhatsApp for receipt ${receipt.receiptSerialNumber} sent successfully.`);
            } else {
              console.warn(`[Background Sender Warn] WhatsApp skipped: customer ${customer.id} has no phone number.`);
            }
          }

          if (method === 'email' || method === 'both') {
            if (customer.email) {
              const { sendEmailReceipt } = await import("../services/emailService");
              results.email = await sendEmailReceipt(customer.email, customer.name, receipt.fileUrl, receipt.receiptSerialNumber.toString());
              console.log(`[Background Sender] Email for receipt ${receipt.receiptSerialNumber} sent successfully.`);
            } else {
              console.warn(`[Background Sender Warn] Email skipped: customer ${customer.id} has no email.`);
            }
          }
        } catch (error: any) {
          console.error(`[Background Sender Error] Failed sending notifications for receipt/sale ID ${saleId}:`, error.message || error);
        }
      });

    } catch (error: any) {
      console.error("Send Error:", error);
      res.status(500).json({ error: error.message || "Failed to send receipt" });
    }
  });

  // --- ODF PDF Generation & Sending ---


  app.get("/api/receipts", authenticateToken, async (req, res) => {
    try {
      const allReceipts = await db.select({
        id: receipts.id,
        saleId: receipts.saleId,
        receiptNo: receipts.receiptSerialNumber,
        fileUrl: receipts.fileUrl,
        createdAt: receipts.createdAt,
        customerName: customers.name,
        totalAmount: sales.amount,
        barcode: stock.barcode,
        itemDetails: sales.itemDetails
      })
      .from(receipts)
      .innerJoin(sales, eq(receipts.saleId, sales.id))
      .innerJoin(customers, eq(sales.customerId, customers.id))
      .leftJoin(stock, eq(sales.stockId, stock.id))
      .orderBy(receipts.createdAt);

      res.json(allReceipts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch receipts" });
    }
  });
}
