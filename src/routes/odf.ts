import type { Express } from "express";
import type { Multer } from "multer";
import { db } from "../db/index";
import { customers, odf, odfItems } from "../db/schema";
import { eq, or, and } from "drizzle-orm";
import { authenticateToken, checkPermission } from "../middleware/auth";
import { checkNotificationConfig } from "../lib/notifications";
import path from "path";

export function registerOdfRoutes(app: Express, upload: Multer) {

  // --- Dedicated ODF Declaration PDF Generation ---
  app.get(["/api/odfs/:id/declaration-pdf", "/api/odf/:id/declaration-pdf"], authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const odfId = parseInt(id);

      const { generateOdfDeclarationPDF } = await import("../services/pdfService");
      const result = await generateOdfDeclarationPDF(odfId);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename=odf-declaration-${odfId}.pdf`);
      
      if (result.buffer) {
        res.send(result.buffer);
      } else if (result.doc) {
        result.doc.pipe(res);
        result.doc.end();
      }
    } catch (error: any) {
      console.error("ODF Declaration PDF Generation Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate ODF declaration PDF" });
    }
  });


  // --- ODF PDF Generation & Sending ---
  app.get("/api/odf/:id/pdf", authenticateToken, async (req, res) => {
    try {
      const odfId = parseInt(req.params.id);

      // Try fetch from storage first
      const recordArr = await db.select().from(odf).where(eq(odf.id, odfId)).limit(1);
      const record = recordArr[0];

      if (record && record.fileUrl) {
        try {
          const { getODFFromStorage } = await import("../services/storageService");
          const fileName = path.basename(record.fileUrl);
          const buffer = await getODFFromStorage(fileName);
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `inline; filename=${fileName}`);
          return res.send(buffer);
        } catch (storageErr) {
          console.warn("ODF local fetch failed:", storageErr);
        }
      }

      // Fallback to dynamic generation
      const { generateODFPDF } = await import("../services/pdfService");
      const { doc } = await generateODFPDF(odfId);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename=odf-${odfId}.pdf`);
      
      doc.pipe(res);
      doc.end();
    } catch (error: any) {
      console.error("ODF PDF Generation Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate ODF PDF" });
    }
  });


  app.post("/api/odf/:id/upload", authenticateToken, async (req, res) => {
    try {
      const odfId = parseInt(req.params.id);
      const { generateODFPDF, getPDFBuffer } = await import("../services/pdfService");
      const { uploadODFToStorage } = await import("../services/storageService");
      const { sanitize } = await import("../lib/utils");
      
      const { doc, odfRecord } = await generateODFPDF(odfId);
      const buffer = await getPDFBuffer(doc);
      
      // Fetch info for dynamic naming
      const odfData = await db.select({
        customer: customers
      })
      .from(odf)
      .leftJoin(customers, eq(odf.customerId, customers.id))
      .where(eq(odf.id, odfId))
      .limit(1);
      
      const clientId = odfData[0]?.customer?.idNumber || "Unknown";
      const fileName = `odf_${sanitize(clientId)}_${odfId}.pdf`;

      const fileUrl = await uploadODFToStorage(fileName, buffer);
      
      await db.update(odf)
        .set({ fileUrl })
        .where(eq(odf.id, odfId));
        
      res.json({
        message: "ODF saved locally successfully",
        file_url: fileUrl
      });
    } catch (error: any) {
      console.error("ODF Upload Error:", error);
      res.status(500).json({ error: error.message || "Failed to save ODF" });
    }
  });


  app.post("/api/odf/:id/send", authenticateToken, async (req, res) => {
    const odfId = parseInt(req.params.id);
    const { method } = req.body; // 'whatsapp', 'email', or 'both'

    if (!checkNotificationConfig(method)) {
      return res.status(412).json({ 
        success: false, 
        error: 'CONFIGURATION_MISSING',
        message: 'WhatsApp or Email service is not configured on the server.'
      });
    }

    try {
      const odfArr = await db.select().from(odf).where(eq(odf.id, odfId)).limit(1);
      if (odfArr.length === 0) return res.status(404).json({ error: "ODF record not found" });
      let record = odfArr[0];

      if (!record.fileUrl) {
        const { generateODFPDF, getPDFBuffer } = await import("../services/pdfService");
        const { uploadODFToStorage } = await import("../services/storageService");
        const { sanitize } = await import("../lib/utils");
        
        const { doc, odfRecord } = await generateODFPDF(odfId);
        const buffer = await getPDFBuffer(doc);
        
        const fileName = `odf-${odfRecord.id}-${sanitize(odfRecord.odfSerialNumber.toString())}.pdf`;
        const fileUrl = await uploadODFToStorage(fileName, buffer);
        
        await db.update(odf)
          .set({ fileUrl })
          .where(eq(odf.id, odfId));
        
        record = { ...odfRecord, fileUrl };
      }

      const customerArr = record.customerId 
        ? await db.select().from(customers).where(eq(customers.id, record.customerId)).limit(1)
        : [];
      const customer = customerArr[0];

      if (!customer) return res.status(404).json({ error: "Customer info required for sending ODF." });

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
              const { sendWhatsAppODF } = await import("../services/whatsappService");
              results.whatsapp = await sendWhatsAppODF(customer.phoneNumber, record.fileUrl, record.odfSerialNumber.toString());
              console.log(`[Background Sender] WhatsApp for ODF ${record.odfSerialNumber} sent successfully.`);
            } else {
              console.warn(`[Background Sender Warn] WhatsApp skipped: customer ${customer.id} has no phone number.`);
            }
          }

          if (method === 'email' || method === 'both') {
            if (customer.email) {
              const { sendEmailODF } = await import("../services/emailService");
              results.email = await sendEmailODF(customer.email, customer.name, record.fileUrl, record.odfSerialNumber.toString());
              console.log(`[Background Sender] Email for ODF ${record.odfSerialNumber} sent successfully.`);
            } else {
              console.warn(`[Background Sender Warn] Email skipped: customer ${customer.id} has no email.`);
            }
          }
        } catch (error: any) {
          console.error(`[Background Sender Error] Failed sending notifications for ODF ID ${odfId}:`, error.message || error);
        }
      });

    } catch (error: any) {
      console.error("ODF Send Error:", error);
      res.status(500).json({ error: error.message || "Failed to send ODF" });
    }
  });

  // --- Reports & Audit Endpoints ---


  // --- ODF (Trade-ins) Endpoints ---
  app.get("/api/odf", authenticateToken, async (req, res) => {
    try {
      const allOdf = await db.select({
        id: odf.id,
        customerId: odf.customerId,
        customerName: customers.name,
        metalType: odf.metalType,
        fineness: odf.fineness,
        weight: odf.weight,
        amount: odf.amount,
        itemReservedRepair: odf.itemReservedRepair,
        description: odf.description,
        comments: odf.comments,
        imageUrl: odf.imageUrl,
        createdAt: odf.createdAt
      })
      .from(odf)
      .innerJoin(customers, eq(odf.customerId, customers.id))
      .orderBy(odf.createdAt);

      const allOdfWithItems = await Promise.all(allOdf.map(async (record) => {
        const items = await db.select().from(odfItems).where(eq(odfItems.odfId, record.id));
        return {
          ...record,
          tradeInItems: items
        };
      }));

      res.json(allOdfWithItems);
    } catch (error) {
      console.error("Failed to fetch ODF records:", error);
      res.status(500).json({ error: "Failed to fetch ODF records" });
    }
  });


  app.post("/api/odf", authenticateToken, checkPermission('odf', 'create'), upload.single('image'), async (req: any, res) => {
    const { customerId, metalType, itemReservedRepair, description, comments, createdAt, fileUrl, tradeInItems, appliedRate } = req.body;
    let imageUrl = null;

    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
    }

    try {
      // Parse tradeInItems
      let parsedItems: any[] = [];
      if (tradeInItems) {
        try {
          parsedItems = typeof tradeInItems === 'string' ? JSON.parse(tradeInItems) : tradeInItems;
        } catch (e) {
          console.error("Error parsing tradeInItems:", e);
        }
      }

      // If no items, but individual parameters were sent, we can fall back to make it backward compatible
      if (parsedItems.length === 0 && (req.body.weight || req.body.amount)) {
        parsedItems.push({
          description: description || "Article",
          mass: req.body.weight || "0",
          fineness: req.body.fineness || "18K"
        });
      }

      // Helper function to get purity fraction
      const getPurityFraction = (fineness: string): number => {
        const clean = String(fineness || '').toLowerCase().trim();
        if (clean.includes('24k') || clean.includes('999') || clean.includes('99.9')) return 1.0;
        if (clean.includes('22k') || clean.includes('916') || clean.includes('91.6')) return 0.916;
        if (clean.includes('18k') || clean.includes('750') || clean.includes('75')) return 0.75;
        if (clean.includes('14k') || clean.includes('585') || clean.includes('58.5')) return 0.585;
        if (clean.includes('9k') || clean.includes('375') || clean.includes('37.5')) return 0.375;
        
        const matchFraction = clean.match(/(\d+)\s*\/\s*(\d+)/);
        if (matchFraction) {
          const num = parseInt(matchFraction[1]);
          const den = parseInt(matchFraction[2]);
          if (den > 0) return num / den;
        }
        
        const matchPct = clean.match(/([\d.]+)\s*%/);
        if (matchPct) {
          return parseFloat(matchPct[1]) / 100;
        }
        
        const matchNum = clean.match(/^(\d+)$/);
        if (matchNum) {
          const val = parseInt(matchNum[1]);
          if (val > 100) return val / 1000;
          if (val > 0) return val / 100;
        }
        
        return 0.75; // Default to 18K
      };

      // Helper function to get metal rate
      const getMetalRatePerGram = (mType: string): number => {
        const metal = String(mType || 'Gold').toLowerCase().trim();
        if (metal.includes('silver') || metal.includes('argent')) {
          return 60; // Rs 60 per gram of pure silver
        }
        if (metal.includes('platinum') || metal.includes('platine')) {
          return 1800; // Rs 1800 per gram of pure platinum
        }
        return 3300; // Rs 3300 per gram of pure gold
      };

      // Backend Calculation: Calculate mass and total amount based on manual prices
      let totalWeight = 0;
      let totalAmount = 0;

      parsedItems.forEach((item: any) => {
        const massVal = parseFloat(item.mass || "0");
        const itemValuation = parseFloat(item.price || "0");
        
        totalWeight += massVal;
        totalAmount += itemValuation;
      });

      // Insert ODF master record
      const newOdf = await db.insert(odf).values({
        customerId: customerId ? parseInt(customerId) : null,
        metalType,
        fineness: parsedItems[0]?.fineness || null, // default to first item's fineness
        weight: totalWeight.toFixed(3),
        amount: totalAmount.toFixed(2),
        itemReservedRepair,
        description,
        comments,
        imageUrl,
        fileUrl,
        date: createdAt ? new Date(createdAt) : new Date(),
        createdAt: createdAt ? new Date(createdAt) : new Date()
      }).returning();

      const createdOdf = newOdf[0];

      // Insert items into odf_items table
      if (parsedItems.length > 0) {
        await Promise.all(parsedItems.map(async (item: any) => {
          await db.insert(odfItems).values({
            odfId: createdOdf.id,
            description: item.description,
            mass: parseFloat(item.mass || "0").toFixed(3),
            fineness: item.fineness,
            price: parseFloat(item.price || "0").toFixed(2)
          });
        }));
      }

      res.status(201).json({
        id: createdOdf.id,
        ...createdOdf,
        tradeInItems: parsedItems
      });
    } catch (error) {
      console.error("ODF Creation Error:", error);
      res.status(500).json({ error: "Failed to create ODF record" });
    }
  });

  // --- Orders Endpoints ---
}
