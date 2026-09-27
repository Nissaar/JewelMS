import type { Express } from "express";
import type { Multer } from "multer";
import { db } from "../db/index";
import { customers, odf, odfItems } from "../db/schema";
import { eq } from "drizzle-orm";
import { authenticateToken, checkPermission } from "../middleware/auth";
import { idParam, odfCreateSchema, sendMethodSchema } from "../lib/schemas";
import { notFound, sendError } from "../lib/errors";
import { assertCanSend, deliverDocument } from "../services/notifications";
import { ensureOdfFile } from "../services/documents";
import { contentTypeFor, readFile, saveImage } from "../services/storage";

export function registerOdfRoutes(app: Express, upload: Multer) {

  app.get(["/api/odfs/:id/declaration-pdf", "/api/odf/:id/declaration-pdf"], authenticateToken, checkPermission('odf', 'view'), async (req, res) => {
    try {
      const odfId = idParam.parse(req.params.id);
      const { generateOdfDeclarationPDF } = await import("../services/pdf");
      const { buffer } = await generateOdfDeclarationPDF(odfId);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="odf-declaration-${odfId}.pdf"`);
      res.send(buffer);
    } catch (error) {
      sendError(res, error, "Failed to generate ODF declaration PDF", "ODF Declaration PDF Generation Error");
    }
  });

  app.get("/api/odf/:id/pdf", authenticateToken, checkPermission('odf', 'view'), async (req, res) => {
    try {
      const odfId = idParam.parse(req.params.id);
      const { generateODFPDF } = await import("../services/pdf");
      const { doc } = await generateODFPDF(odfId);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="odf-${odfId}.pdf"`);
      doc.pipe(res);
      doc.end();
    } catch (error) {
      sendError(res, error, "Failed to generate ODF PDF", "ODF PDF Generation Error");
    }
  });

  app.get("/api/odf/:id/image", authenticateToken, checkPermission('odf', 'view'), async (req, res) => {
    try {
      const odfId = idParam.parse(req.params.id);
      const [record] = await db.select({ imageUrl: odf.imageUrl }).from(odf).where(eq(odf.id, odfId)).limit(1);
      if (!record?.imageUrl) throw notFound("No photo for this ODF");
      const data = await readFile('images', record.imageUrl);
      res.setHeader('Content-Type', contentTypeFor(record.imageUrl));
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.send(data);
    } catch (error) {
      sendError(res, error, "Failed to load photo");
    }
  });

  app.post("/api/odf/:id/send", authenticateToken, checkPermission('odf', 'create'), async (req, res) => {
    try {
      const odfId = idParam.parse(req.params.id);
      const { method } = sendMethodSchema.parse(req.body);

      const [record] = await db.select().from(odf).where(eq(odf.id, odfId)).limit(1);
      if (!record) throw notFound("ODF record not found");
      const [customer] = record.customerId
        ? await db.select().from(customers).where(eq(customers.id, record.customerId)).limit(1)
        : [];
      assertCanSend(method, customer);

      await ensureOdfFile(odfId);

      res.json({
        success: true,
        message: "Demande reçue. L'envoi est en cours d'exécution en arrière-plan.",
        results: { queued: true },
      });
      setImmediate(() => deliverDocument('odf', odfId, method, customer));
    } catch (error) {
      sendError(res, error, "Failed to send ODF", "ODF Send Error");
    }
  });

  app.get("/api/odf", authenticateToken, checkPermission('odf', 'view'), async (req, res) => {
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
          // The stored name is internal; clients load the photo via /api/odf/:id/image.
          imageUrl: record.imageUrl ? `/api/odf/${record.id}/image` : null,
          tradeInItems: items
        };
      }));

      res.json(allOdfWithItems);
    } catch (error) {
      sendError(res, error, "Failed to fetch ODF records");
    }
  });

  app.post("/api/odf", authenticateToken, checkPermission('odf', 'create'), upload.single('image'), async (req, res) => {
    try {
      const input = odfCreateSchema.parse(req.body);
      const imageName = req.file ? await saveImage(req.file.buffer) : null;

      const totalWeight = input.tradeInItems.reduce((sum, item) => sum + item.mass, 0);
      const totalAmount = input.tradeInItems.reduce((sum, item) => sum + item.price, 0);
      const date = input.createdAt ?? new Date();

      const created = await db.transaction(async (tx: any) => {
        const [record] = await tx.insert(odf).values({
          customerId: input.customerId,
          metalType: input.metalType,
          fineness: input.tradeInItems[0].fineness,
          weight: totalWeight.toFixed(3),
          amount: totalAmount.toFixed(2),
          itemReservedRepair: input.itemReservedRepair,
          description: input.description,
          comments: input.comments,
          imageUrl: imageName,
          date,
          createdAt: date,
        }).returning();

        await tx.insert(odfItems).values(input.tradeInItems.map(item => ({
          odfId: record.id,
          description: item.description,
          mass: item.mass.toFixed(3),
          fineness: item.fineness,
          price: item.price.toFixed(2),
        })));
        return record;
      });

      res.status(201).json({
        ...created,
        imageUrl: created.imageUrl ? `/api/odf/${created.id}/image` : null,
        tradeInItems: input.tradeInItems,
      });
    } catch (error) {
      sendError(res, error, "Failed to create ODF record", "ODF Creation Error");
    }
  });
}
