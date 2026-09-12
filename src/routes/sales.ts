import type { Express } from "express";
import { db } from "../db/index";
import { stock, customers, receipts, orders, sales, saleItems, odf, auditLogs } from "../db/schema";
import { eq, or, ilike, and, sql } from "drizzle-orm";
import { authenticateToken, checkPermission } from "../middleware/auth";
import { badRequest, notFound, statusFor } from "../lib/errors";

export function registerSalesRoutes(app: Express) {

  // --- Sales Recording Endpoint ---
  app.post("/api/sales", authenticateToken, checkPermission('sales', 'create'), async (req, res) => {
    const { 
      customerId, 
      paymentMode, 
      chequeNumber, 
      orderId, 
      linkedOdfId, 
      linkedCommandeId,
      items: inputItems,
      stock_ids,
      // fallback single item fields:
      barcode,
      qty,
      amount,
      unitSalesPrice,
      discountAmount,
      discountPercentage,
      itemDetails
    } = req.body;

    try {
      const result = await db.transaction(async (tx) => {
        const lOdfId = linkedOdfId ? parseInt(linkedOdfId) : null;
        const lCommandeId = linkedCommandeId ? parseInt(linkedCommandeId) : null;

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

        // Standardize items list
        let rawItemsList: any[] = [];
        if (Array.isArray(inputItems) && inputItems.length > 0) {
          rawItemsList = inputItems;
        } else if (Array.isArray(stock_ids) && stock_ids.length > 0) {
          rawItemsList = stock_ids.map((sId: any) => ({ stockId: typeof sId === 'object' ? sId.id || sId.stockId : sId }));
        } else if (barcode) {
          rawItemsList = [{
            barcode,
            qty: qty || 1,
            amount,
            unitSalesPrice,
            discountAmount,
            discountPercentage,
            itemDetails
          }];
        }

        if (rawItemsList.length === 0) {
          throw badRequest("Aucun article spécifié pour la vente.");
        }

        // Process each item in cart
        const processedItems: any[] = [];
        let totalAmountNum = 0;
        let totalDiscountNum = 0;

        for (const rawItem of rawItemsList) {
          let stockItem: any = null;

          // Lock the row for the duration of the transaction. Without this, two
          // concurrent checkouts can both read the item as 'Disponible' and both
          // mark it sold.
          if (rawItem.stockId) {
            const items = await tx.select().from(stock)
              .where(and(eq(stock.id, rawItem.stockId), eq(stock.status, 'Disponible')))
              .limit(1)
              .for('update');
            if (items.length > 0) stockItem = items[0];
          } else if (rawItem.barcode) {
            const items = await tx.select().from(stock)
              .where(and(eq(stock.barcode, rawItem.barcode), eq(stock.status, 'Disponible')))
              .limit(1)
              .for('update');
            if (items.length > 0) stockItem = items[0];
          }

          if (!stockItem) {
            throw badRequest(`Un article du panier (Code-barres: ${rawItem.barcode || rawItem.stockId || 'Inconnu'}) n'est plus disponible en stock.`);
          }

          const itemQty = Number(rawItem.qty || 1);
          const itemNetPrice = rawItem.amount ? parseFloat(String(rawItem.amount)) : (stockItem.price ? parseFloat(stockItem.price) / 1.15 : 0);
          const itemUnitPrice = rawItem.unitSalesPrice ? parseFloat(String(rawItem.unitSalesPrice)) : itemNetPrice;
          const itemDisc = rawItem.discountAmount ? parseFloat(String(rawItem.discountAmount)) : 0;

          // Multiply by quantity: the frontend totals as netPrice * qty, and the
          // two must agree or the recorded sale undercharges.
          totalAmountNum += itemNetPrice * itemQty;
          totalDiscountNum += itemDisc * itemQty;

          const desc = rawItem.itemDetails || `${stockItem.barcode || ''} - ${stockItem.category || ''} ${stockItem.subCategory || ''} ${stockItem.metalType ? `(${stockItem.metalType})` : ''}`.trim().replace(/\s+/g, ' ');

          processedItems.push({
            stockItem,
            stockId: stockItem.id,
            barcode: stockItem.barcode,
            qty: itemQty,
            itemDetails: desc,
            unitSalesPrice: itemUnitPrice.toFixed(2),
            amount: itemNetPrice.toFixed(2),
            weight: stockItem.weightGrams,
            fineness: stockItem.fineness,
            metalType: stockItem.metalType
          });
        }

        const totalVatNum = totalAmountNum * 0.15;
        const mainStockItem = processedItems[0]?.stockItem;

        // 1. Insert parent sale
        const newSale = await tx.insert(sales).values({
          customerId,
          stockId: mainStockItem ? mainStockItem.id : null,
          paymentMode,
          chequeNumber,
          qty: processedItems.reduce((acc, curr) => acc + curr.qty, 0),
          itemDetails: processedItems.length === 1 ? processedItems[0].itemDetails : `${processedItems.length} articles en panier`,
          weight: mainStockItem ? mainStockItem.weightGrams : null,
          fineness: mainStockItem ? mainStockItem.fineness : null,
          unitSalesPrice: totalAmountNum.toFixed(2),
          amount: totalAmountNum.toFixed(2),
          discountAmount: totalDiscountNum.toFixed(2),
          discountPercentage: (discountPercentage !== undefined && discountPercentage !== null) ? discountPercentage.toString() : '0.00',
          vat15: totalVatNum.toFixed(2),
          metalType: mainStockItem ? mainStockItem.metalType : null,
          orderId: orderId || lCommandeId || null,
          linkedOdfId: lOdfId,
          linkedCommandeId: lCommandeId,
        }).returning();

        const saleId = newSale[0].id;

        // 2. Insert into sale_items table & mark stock items as sold
        for (const pItem of processedItems) {
          await tx.insert(saleItems).values({
            saleId,
            stockId: pItem.stockId,
            barcode: pItem.barcode,
            itemDetails: pItem.itemDetails,
            qty: pItem.qty,
            unitSalesPrice: pItem.unitSalesPrice,
            amount: pItem.amount,
            weight: pItem.weight,
            fineness: pItem.fineness,
            metalType: pItem.metalType,
          });

          await tx.update(stock)
            .set({ status: 'Vendu', soldAt: new Date(), updatedAt: new Date() })
            .where(eq(stock.id, pItem.stockId));
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
    } catch (error: any) {
      if (statusFor(error) === 500) console.error("Sales Recording Error:", error);
      res.status(statusFor(error)).json({ error: error.message || "Failed to record sale" });
    }
  });


  app.post("/api/sales/:id/cancel", authenticateToken, async (req: any, res) => {
    if (req.user?.role !== 'Admin') return res.status(403).json({ error: "Admin access required" });
    
    const saleId = parseInt(req.params.id);

    try {
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
    } catch (error: any) {
      console.error("Sale Cancellation Error:", error);
      res.status(statusFor(error)).json({ error: error.message || "Erreur lors de l'annulation de la vente" });
    }
  });

  // --- Stock Endpoints ---


  app.get("/api/sales/history", authenticateToken, async (req, res) => {
    try {
      const { search, query, q } = req.query;
      const searchTerm = (search || query || q)?.toString();

      let conditions = [];
      if (searchTerm) {
        conditions.push(ilike(sales.itemDetails, `%${searchTerm}%`));
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
        barcode: stock.barcode,
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
      console.error("Sales History Error:", error);
      res.status(500).json({ error: "Failed to fetch sales history" });
    }
  });
}
