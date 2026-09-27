import type { Express } from "express";
import { db } from "../db/index";
import { stock, customers, receipts, orders, sales, saleItems, odf, auditLogs } from "../db/schema";
import { eq, or, ilike, and, sql } from "drizzle-orm";
import { authenticateToken, checkPermission, requireAdmin } from "../middleware/auth";
import { badRequest, notFound, sendError } from "../lib/errors";
import { idParam, saleCreateSchema } from "../lib/schemas";
import { escapeLike } from "../lib/sql";
import { saleBarcodes } from "../services/reportData";
import { centsToDecimal, splitGross, sumLines, toCents } from "../shared/money";

export function registerSalesRoutes(app: Express) {

  // --- Sales Recording Endpoint ---
  app.post("/api/sales", authenticateToken, checkPermission('sales', 'create'), async (req, res) => {
    try {
      const { customerId, paymentMode, chequeNumber, orderId, linkedOdfId: lOdfId, linkedCommandeId: lCommandeId, items: rawItemsList } =
        saleCreateSchema.parse(req.body);

      const result = await db.transaction(async (tx) => {
        // Verify linked ODF has a completed Declaration of Ownership (Customer profile details filled)
        if (lOdfId) {
          const odfRecords = await tx.select().from(odf).where(eq(odf.id, lOdfId)).limit(1);
          if (odfRecords.length === 0) {
            throw notFound("L'ODF lié est introuvable");
          }
          const odfRec = odfRecords[0];
          if (!odfRec.customerId) {
            throw badRequest("L'ODF lié ne possède pas de client associé");
          }
          const custRecords = await tx.select().from(customers).where(eq(customers.id, odfRec.customerId)).limit(1);
          if (custRecords.length === 0) {
            throw notFound("Le client associé à l'ODF lié est introuvable");
          }
          const cust = custRecords[0];
          if (!cust.name) {
            throw badRequest("Le client associé à l'ODF doit avoir un nom.");
          }
        }

        // Verify linked Commande exists
        if (lCommandeId) {
          const orderRecords = await tx.select().from(orders).where(eq(orders.id, lCommandeId)).limit(1);
          if (orderRecords.length === 0) {
            throw notFound("La commande liée est introuvable");
          }
        }

        const stockIds = rawItemsList.map(i => i.stockId);
        if (new Set(stockIds).size !== stockIds.length) {
          throw badRequest("Le même article figure deux fois dans le panier.");
        }

        // Price every line from its stock record. The till only supplies the
        // discount, which must leave a positive price.
        const processedItems = [];
        for (const rawItem of rawItemsList) {
          // Lock the row for the duration of the transaction. Without this, two
          // concurrent checkouts can both read the item as 'Disponible' and both
          // mark it sold.
          const [stockItem] = await tx.select().from(stock)
            .where(and(eq(stock.id, rawItem.stockId), eq(stock.status, 'Disponible')))
            .limit(1)
            .for('update');
          if (!stockItem) {
            throw badRequest(`Un article du panier (ID: ${rawItem.stockId}) n'est plus disponible en stock.`);
          }

          const listCents = toCents(stockItem.price);
          const discountCents = toCents(rawItem.discountAmount);
          if (listCents <= 0) {
            throw badRequest(`L'article ${stockItem.barcode} n'a pas de prix. Ajoutez un prix dans le Stock avant de le vendre.`);
          }
          if (discountCents >= listCents) {
            throw badRequest(`La remise sur l'article ${stockItem.barcode} ne peut pas atteindre ou dépasser son prix.`);
          }

          const line = splitGross(listCents - discountCents);
          const metal = [stockItem.metalType, stockItem.fineness].filter(Boolean).join(' ');
          processedItems.push({
            stockItem,
            line,
            listCents,
            discountCents,
            itemDetails: `${stockItem.subCategory || stockItem.category}${metal ? ` (${metal})` : ''}`,
          });
        }

        const totals = sumLines(processedItems.map(p => p.line));
        const totalListCents = processedItems.reduce((sum, p) => sum + p.listCents, 0);
        const totalDiscountCents = processedItems.reduce((sum, p) => sum + p.discountCents, 0);
        const totalWeight = processedItems.reduce((sum, p) => sum + Number(p.stockItem.weightGrams || 0), 0);
        const first = processedItems[0].stockItem;
        const sameMetal = processedItems.every(p => p.stockItem.metalType === first.metalType && p.stockItem.fineness === first.fineness);

        // 1. Insert parent sale. amount is net of VAT and of discounts.
        const newSale = await tx.insert(sales).values({
          customerId,
          stockId: first.id,
          paymentMode,
          chequeNumber: paymentMode === 'Cheque' ? chequeNumber : null,
          qty: processedItems.length,
          itemDetails: processedItems.length === 1 ? processedItems[0].itemDetails : `${processedItems.length} articles en panier`,
          weight: totalWeight ? totalWeight.toFixed(3) : null,
          fineness: sameMetal ? first.fineness : null,
          metalType: sameMetal ? first.metalType : null,
          unitSalesPrice: centsToDecimal(totals.netCents),
          amount: centsToDecimal(totals.netCents),
          vat15: centsToDecimal(totals.vatCents),
          discountAmount: centsToDecimal(totalDiscountCents),
          discountPercentage: (totalDiscountCents / totalListCents * 100).toFixed(2),
          orderId: orderId || lCommandeId || null,
          linkedOdfId: lOdfId,
          linkedCommandeId: lCommandeId,
        }).returning();

        const saleId = newSale[0].id;

        // 2. Insert into sale_items table & mark stock items as sold
        for (const { stockItem, line, itemDetails } of processedItems) {
          await tx.insert(saleItems).values({
            saleId,
            stockId: stockItem.id,
            barcode: stockItem.barcode,
            itemDetails,
            qty: 1,
            unitSalesPrice: centsToDecimal(line.netCents),
            amount: centsToDecimal(line.netCents),
            weight: stockItem.weightGrams,
            fineness: stockItem.fineness,
            metalType: stockItem.metalType,
          });

          await tx.update(stock)
            .set({ status: 'Vendu', soldAt: new Date(), updatedAt: new Date() })
            .where(eq(stock.id, stockItem.id));
        }

        // 3. Create associated receipt
        const newReceipt = await tx.insert(receipts).values({
          saleId
        }).returning();

        return {
          ...newSale[0],
          receipt: newReceipt[0]
        };
      });

      res.status(201).json({ 
        sales_id: result.id, 
        sale: result,
        receipt: result.receipt
      });
    } catch (error) {
      sendError(res, error, "Failed to record sale", "Sales Recording Error");
    }
  });


  app.post("/api/sales/:id/cancel", authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const saleId = idParam.parse(req.params.id);
      await db.transaction(async (tx) => {
        const saleRecords = await tx.select().from(sales).where(eq(sales.id, saleId)).limit(1);
        if (saleRecords.length === 0) throw notFound("Vente non trouvée");
        const sale = saleRecords[0];

        if (sale.status === 'Cancelled') throw badRequest("La vente est déjà annulée");

        // Get all items in sale_items
        const items = await tx.select().from(saleItems).where(eq(saleItems.saleId, saleId));
        const stockIdsToRestore = new Set<number>();

        if (items.length > 0) {
          items.forEach(it => { if (it.stockId) stockIdsToRestore.add(it.stockId); });
        }
        if (sale.stockId) {
          stockIdsToRestore.add(sale.stockId);
        }

        // Restore all stock items
        for (const sId of stockIdsToRestore) {
          await tx.update(stock)
            .set({ 
              status: 'Disponible', 
              soldAt: null, 
              updatedAt: new Date() 
            })
            .where(eq(stock.id, sId));
        }

        // Update sale status to 'Cancelled'
        await tx.update(sales)
          .set({ status: 'Cancelled' })
          .where(eq(sales.id, saleId));

        // Log to audit trail
        await tx.insert(auditLogs).values({
          userId: req.user.id,
          actionType: 'CANCEL_SALE',
          details: { saleId, restoredStockIds: Array.from(stockIdsToRestore) },
          ipAddress: req.ip,
          userAgent: req.get('user-agent')
        });
      });

      res.json({ message: "Vente annulée avec succès. Les articles sont de nouveau en stock." });
    } catch (error) {
      sendError(res, error, "Erreur lors de l'annulation de la vente", "Sale Cancellation Error");
    }
  });

  app.get("/api/sales/history", authenticateToken, checkPermission('sales', 'view'), async (req, res) => {
    try {
      const { search, query, q } = req.query;
      const searchTerm = (search || query || q)?.toString();

      let conditions = [];
      if (searchTerm) {
        conditions.push(ilike(sales.itemDetails, `%${escapeLike(searchTerm)}%`));
      }

      const history = await db.select({
        id: sales.id,
        receiptId: receipts.id,
        receiptNo: receipts.receiptSerialNumber,
        date: sales.datetime,
        customerName: customers.name,
        totalAmount: sales.amount,
        paymentMode: sales.paymentMode,
        vat15: sales.vat15,
        itemDetails: sales.itemDetails,
        barcode: saleBarcodes,
        category: stock.category,
        subCategory: stock.subCategory,
        weight: sales.weight,
        unitSalesPrice: sales.unitSalesPrice,
        qty: sales.qty,
        chequeNumber: sales.chequeNumber,
        metalType: sales.metalType,
        fineness: sales.fineness,
        fileUrl: receipts.fileUrl,
        orderId: sales.orderId,
        orderDeposit: orders.deposit,
        orderNumber: orders.orderNumber,
        linkedOdfId: sales.linkedOdfId,
        status: sales.status
      })
      .from(sales)
      .leftJoin(customers, eq(sales.customerId, customers.id))
      .leftJoin(receipts, eq(sales.id, receipts.saleId))
      .leftJoin(stock, eq(sales.stockId, stock.id))
      .leftJoin(orders, eq(sales.orderId, orders.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(sql`${sales.datetime} DESC`);

      res.json(history);
    } catch (error) {
      sendError(res, error, "Failed to fetch sales history", "Sales History Error");
    }
  });
}
