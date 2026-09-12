import type { Express } from "express";
import { db } from "../db/index";
import { stock, customers, receipts, orders, sales, odf, odfItems } from "../db/schema";
import { eq, or, ilike, and, sql } from "drizzle-orm";
import { authenticateToken, checkPermission } from "../middleware/auth";

export function registerReportsRoutes(app: Express) {

  // --- Search & Reporting Endpoints ---
  app.get("/api/reports/dashboard-summary", authenticateToken, checkPermission('reports', 'view'), async (req: any, res) => {
    try {
      // Use PostgreSQL's CURRENT_DATE for more reliable "today" filtering
      const [todaySalesRes, newClientsRes, stockCountRes, pendingOrdersRes, recentSalesRes] = await Promise.all([
        db.select({ total: sql<string>`SUM(${sales.amount})` })
          .from(sales)
          .where(sql`DATE(${sales.datetime} AT TIME ZONE 'UTC') = CURRENT_DATE`),
        
        db.select({ count: sql<number>`COUNT(${customers.id})`.mapWith(Number) })
          .from(customers)
          .where(sql`DATE(${customers.createdAt} AT TIME ZONE 'UTC') = CURRENT_DATE`),
        
        db.select({ 
          count: sql<number>`COUNT(${stock.id})`.mapWith(Number),
          totalWeight: sql<string>`SUM(COALESCE(${stock.weightGrams}, 0))`
        })
          .from(stock)
          .where(eq(stock.status, 'Disponible')),
        
        db.select({ count: sql<number>`COUNT(${orders.id})`.mapWith(Number) })
          .from(orders)
          .where(eq(orders.status, 'Pending')),
        
        db.select({
          id: sales.id,
          amount: sales.amount,
          itemDetails: sales.itemDetails,
          datetime: sales.datetime,
          customerName: customers.name
        })
        .from(sales)
        .leftJoin(customers, eq(sales.customerId, customers.id))
        .orderBy(sql`${sales.datetime} DESC`)
        .limit(5)
      ]);

      res.json({
        todaySales: parseFloat(todaySalesRes[0].total || "0"),
        newClients: newClientsRes[0].count,
        stockCount: stockCountRes[0].count,
        totalWeight: parseFloat(stockCountRes[0].totalWeight || "0"),
        pendingOrders: pendingOrdersRes[0].count,
        recentSales: recentSalesRes
      });
    } catch (error) {
      console.error("Dashboard Summary Error:", error);
      res.status(500).json({ error: "Failed to fetch dashboard summary" });
    }
  });


  app.get("/api/search", authenticateToken, async (req, res) => {
    const { q } = req.query;
    const isDefault = !q || typeof q !== 'string' || q.trim() === '';
    const searchStr = isDefault ? '' : `%${q}%`;

    try {
      if (isDefault) {
        const [stockRecent, customersRecent] = await Promise.all([
          db.select().from(stock).where(eq(stock.status, 'Disponible')).orderBy(sql`${stock.createdAt} DESC`).limit(20),
          db.select().from(customers).orderBy(sql`${customers.createdAt} DESC`).limit(20)
        ]);
        return res.json({
          stock: stockRecent,
          customers: customersRecent,
          receipts: [],
          orders: []
        });
      }

      const [stockResults, customerResults, receiptResults, orderResults] = await Promise.all([
        db.select().from(stock).where(
          and(
            eq(stock.status, 'Disponible'),
            or(
              ilike(stock.barcode, searchStr), 
              ilike(stock.itemCode, searchStr), 
              ilike(stock.serialNumber, searchStr),
              ilike(stock.category, searchStr),
              ilike(stock.subCategory, searchStr),
              ilike(stock.brand, searchStr),
              ilike(stock.metalType, searchStr),
              ilike(stock.fineness, searchStr)
            )
          )
        ).limit(20),
        db.select().from(customers).where(or(ilike(customers.name, searchStr), ilike(customers.idNumber, searchStr))).limit(20),
        db.select().from(receipts).where(sql`CAST(${receipts.receiptSerialNumber} AS TEXT) ILIKE ${searchStr}`).limit(20),
        db.select().from(orders).where(sql`CAST(${orders.orderNumber} AS TEXT) ILIKE ${searchStr}`).limit(20)
      ]);

      res.json({
        stock: stockResults,
        customers: customerResults,
        receipts: receiptResults,
        orders: orderResults
      });
    } catch (error) {
      console.error("Search Error:", error);
      res.status(500).json({ error: "Search failed" });
    }
  });


  app.get("/api/reports/stock-weight", authenticateToken, checkPermission('reports', 'view'), async (req, res) => {
    const { category, subCategory, groupBy } = req.query;
    try {
      const conditions = [eq(stock.status, 'Disponible')];
      if (category) conditions.push(eq(stock.category, category as string));
      if (subCategory) conditions.push(eq(stock.subCategory, subCategory as string));

      // Primary report: Weight by Metal and Location
      const results = await db.select({
        metalType: stock.metalType,
        stockType: stock.stockType,
        category: stock.category,
        totalWeight: sql<string>`CAST(SUM(COALESCE(${stock.weightGrams}, 0)) AS NUMERIC(15, 3))`,
        itemCount: sql<number>`COUNT(${stock.id})`.mapWith(Number)
      })
      .from(stock)
      .where(and(...conditions))
      .groupBy(stock.metalType, stock.stockType, stock.category);

      // Format results for the frontend
      const report: any = { 
        Gold: {}, 
        Silver: {}, 
        Other: {},
        byCategory: {} // New breakdown by category
      };
      
      results.forEach(row => {
        let metal = 'Other';
        if (row.metalType) {
          const m = row.metalType.toLowerCase();
          if (m.includes('gold') || m.includes('or')) metal = 'Gold';
          else if (m.includes('silver') || m.includes('argent')) metal = 'Silver';
          else metal = row.metalType.charAt(0).toUpperCase() + row.metalType.slice(1).toLowerCase();
        }

        if (!report[metal]) report[metal] = {};
        
        // Frontend expects: report[Metal][Location] = totalGrams
        const location = row.stockType || 'unknown';
        const weightValue = parseFloat(row.totalWeight);
        report[metal][location] = Number(((report[metal][location] || 0) + weightValue).toFixed(3));
        
        // Category breakdown
        const cat = row.category || 'Non classé';
        if (!report.byCategory[cat]) {
          report.byCategory[cat] = { totalWeight: 0, itemCount: 0, byMetal: {} };
        }
        report.byCategory[cat].totalWeight = Number((report.byCategory[cat].totalWeight + weightValue).toFixed(3));
        report.byCategory[cat].itemCount += row.itemCount;
        
        if (!report.byCategory[cat].byMetal[metal]) {
          report.byCategory[cat].byMetal[metal] = 0;
        }
        report.byCategory[cat].byMetal[metal] = Number((report.byCategory[cat].byMetal[metal] + weightValue).toFixed(3));
      });

      res.json(report);
    } catch (error) {
      console.error("Reporting Error:", error);
      res.status(500).json({ error: "Failed to generate weight report" });
    }
  });

  // Settings Endpoints (Admin only)


  // --- Reports & Audit Endpoints ---
  app.get("/api/reports/vat", authenticateToken, checkPermission('reports', 'view'), async (req: any, res) => {
    const { day, month, year } = req.query;
    try {
      let conditions = [];
      if (year) conditions.push(sql`EXTRACT(YEAR FROM ${sales.createdAt}) = ${year}`);
      if (month) conditions.push(sql`EXTRACT(MONTH FROM ${sales.createdAt}) = ${month}`);
      if (day) conditions.push(sql`EXTRACT(DAY FROM ${sales.createdAt}) = ${day}`);

      const reportData = await db.select({
        saleId: sales.id,
        receiptNo: receipts.receiptSerialNumber,
        itemDetails: sales.itemDetails,
        weight: sales.weight,
        amountExclVat: sales.amount,
        createdAt: sales.createdAt
      })
      .from(sales)
      .leftJoin(receipts, eq(sales.id, receipts.saleId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(sales.id);

      const calculatedData = reportData.map(row => {
        const amount = parseFloat(row.amountExclVat || "0");
        const vat = amount * 0.15;
        return {
          ...row,
          vatAmount: vat.toFixed(2),
          total: (amount + vat).toFixed(2)
        };
      });

      const totalVat = calculatedData.reduce((sum, row) => sum + parseFloat(row.vatAmount), 0);

      res.json({ data: calculatedData, summary: { totalVat: totalVat.toFixed(2) } });
    } catch (error) {
      console.error("VAT Report Error:", error);
      res.status(500).json({ error: "Failed to fetch VAT report" });
    }
  });


  app.get("/api/reports/vat/pdf", authenticateToken, checkPermission('reports', 'view'), async (req: any, res) => {
    const { day, month, year } = req.query;
    try {
      const { generateVatReportPDF } = await import("../services/pdfService");
      const doc = await generateVatReportPDF(day?.toString(), month?.toString(), year?.toString());

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=rapport-tva.pdf');

      doc.pipe(res);
      doc.end();
    } catch (error: any) {
      console.error("VAT PDF Generation Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate VAT PDF report" });
    }
  });

  // --- Registre Trade-In (Assay Office) Endpoints ---


  // --- Registre Trade-In (Assay Office) Endpoints ---
  app.get("/api/reports/tradein", authenticateToken, checkPermission('reports', 'view'), async (req: any, res) => {
    const { startDate, endDate } = req.query;
    try {
      let conditions = [];
      if (startDate) {
        conditions.push(sql`${odf.createdAt} >= ${new Date(startDate as string)}`);
      }
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        conditions.push(sql`${odf.createdAt} <= ${end}`);
      }

      const allOdf = await db.select({
        id: odf.id,
        odfSerialNumber: odf.odfSerialNumber,
        createdAt: odf.createdAt,
        customerId: odf.customerId,
        customerName: customers.name,
        customerNIC: customers.idNumber,
        customerAddress: customers.address,
        metalType: odf.metalType,
        fineness: odf.fineness,
        weight: odf.weight,
        amount: odf.amount,
        description: odf.description,
        receiptNo: receipts.receiptSerialNumber
      })
      .from(odf)
      .innerJoin(customers, eq(odf.customerId, customers.id))
      .leftJoin(sales, eq(sales.linkedOdfId, odf.id))
      .leftJoin(receipts, eq(receipts.saleId, sales.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(odf.createdAt);

      const allOdfWithItems = await Promise.all(allOdf.map(async (record) => {
        const items = await db.select().from(odfItems).where(eq(odfItems.odfId, record.id));
        return {
          ...record,
          tradeInItems: items
        };
      }));

      // Flatten items for the ledger
      const flattened = [];
      for (const record of allOdfWithItems) {
        if (record.tradeInItems && record.tradeInItems.length > 0) {
          for (const item of record.tradeInItems) {
            flattened.push({
              id: record.id,
              date: record.createdAt,
              customerName: record.customerName,
              customerNIC: record.customerNIC,
              customerAddress: record.customerAddress,
              description: item.description || `${record.metalType} ${item.fineness || record.fineness}`,
              weight: item.mass,
              fineness: item.fineness,
              invNo: `#ODF-${record.odfSerialNumber || record.id}`,
              out: record.receiptNo ? `#FS-${record.receiptNo}` : '-'
            });
          }
        } else {
          flattened.push({
            id: record.id,
            date: record.createdAt,
            customerName: record.customerName,
            customerNIC: record.customerNIC,
            customerAddress: record.customerAddress,
            description: record.description || `${record.metalType} ${record.fineness}`,
            weight: record.weight,
            fineness: record.fineness,
            invNo: `#ODF-${record.odfSerialNumber || record.id}`,
            out: record.receiptNo ? `#FS-${record.receiptNo}` : '-'
          });
        }
      }

      res.json(flattened);
    } catch (error) {
      console.error("Trade-In Ledger Report Error:", error);
      res.status(500).json({ error: "Failed to fetch trade-in ledger report" });
    }
  });


  app.get("/api/reports/tradein/pdf", authenticateToken, checkPermission('reports', 'view'), async (req: any, res) => {
    const { startDate, endDate } = req.query;
    try {
      const { generateTradeInReportPDF } = await import("../services/pdfService");
      const doc = await generateTradeInReportPDF(startDate?.toString(), endDate?.toString());

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=registre-tradein-${startDate || 'all'}-to-${endDate || 'all'}.pdf`);

      doc.pipe(res);
      doc.end();
    } catch (error: any) {
      console.error("Trade-In PDF Generation Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate Trade-In PDF report" });
    }
  });


  app.get("/api/reports/sales-by-metal/pdf", authenticateToken, checkPermission('reports', 'view'), async (req: any, res) => {
    const { startDate, endDate, metalType, fineness } = req.query;
    try {
      const { generateSalesByMetalReportPDF } = await import("../services/pdfService");
      const doc = await generateSalesByMetalReportPDF(
        startDate?.toString(),
        endDate?.toString(),
        metalType?.toString(),
        fineness?.toString()
      );

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=rapport-ventes-metal-${metalType || 'all'}-${fineness || 'all'}.pdf`);

      doc.pipe(res);
      doc.end();
    } catch (error: any) {
      console.error("Sales by Metal PDF Generation Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate Sales by Metal PDF report" });
    }
  });

  // --- Sales by Metal Report Endpoint ---


  // --- Sales by Metal Report Endpoint ---
  app.get("/api/reports/sales-by-metal", authenticateToken, checkPermission('reports', 'view'), async (req: any, res) => {
    const { startDate, endDate, metalType, fineness } = req.query;
    try {
      let conditions = [];
      
      // Filter out cancelled sales
      conditions.push(eq(sales.status, 'Completed'));

      if (startDate) {
        conditions.push(sql`${sales.createdAt} >= ${new Date(startDate as string)}`);
      }
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        conditions.push(sql`${sales.createdAt} <= ${end}`);
      }

      if (metalType && metalType !== 'all') {
        let mType = (metalType as string).toLowerCase().trim();
        if (mType === 'or' || mType === 'gold') {
          conditions.push(or(ilike(sales.metalType, 'Gold'), ilike(sales.metalType, 'Or')));
        } else if (mType === 'argent' || mType === 'silver') {
          conditions.push(or(ilike(sales.metalType, 'Silver'), ilike(sales.metalType, 'Argent')));
        } else if (mType === 'platine' || mType === 'platinum') {
          conditions.push(or(ilike(sales.metalType, 'Platinum'), ilike(sales.metalType, 'Platine')));
        } else {
          conditions.push(ilike(sales.metalType, metalType as string));
        }
      }

      if (fineness && fineness !== 'all') {
        conditions.push(ilike(sales.fineness, fineness as string));
      }

      const matchingSales = await db.select({
        id: sales.id,
        createdAt: sales.createdAt,
        customerName: customers.name,
        itemDetails: sales.itemDetails,
        barcode: stock.barcode,
        metalType: sales.metalType,
        fineness: sales.fineness,
        weight: sales.weight,
        amount: sales.amount,
        vat15: sales.vat15,
        receiptNo: receipts.receiptSerialNumber
      })
      .from(sales)
      .leftJoin(customers, eq(sales.customerId, customers.id))
      .leftJoin(stock, eq(sales.stockId, stock.id))
      .leftJoin(receipts, eq(sales.id, receipts.saleId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(sql`${sales.createdAt} DESC`);

      let totalWeight = 0;
      let totalRevenue = 0;
      
      const items = matchingSales.map(row => {
        const w = parseFloat(row.weight || "0");
        const amt = parseFloat(row.amount || "0");
        const vat = parseFloat(row.vat15 || "0");
        const totalWithVat = amt + vat;
        
        totalWeight += w;
        totalRevenue += amt;
        
        return {
          ...row,
          weight: w,
          amount: amt,
          totalWithVat: totalWithVat
        };
      });

      res.json({
        items,
        summary: {
          totalWeight,
          totalRevenue,
          totalRevenueWithVat: items.reduce((sum, item) => sum + item.totalWithVat, 0),
          count: items.length
        }
      });
    } catch (error) {
      console.error("Sales by Metal Report Error:", error);
      res.status(500).json({ error: "Failed to generate sales by metal report" });
    }
  });

  // --- Discount Report Endpoint ---


  // --- Discount Report Endpoint ---
  app.get("/api/reports/discounts", authenticateToken, checkPermission('reports', 'view'), async (req: any, res) => {
    try {
      const discountReport = await db.select({
        saleId: sales.id,
        createdAt: sales.createdAt,
        customerName: customers.name,
        customerIdNumber: customers.idNumber,
        itemBarcode: stock.barcode,
        itemDetails: sales.itemDetails,
        stockPrice: stock.price,
        amount: sales.amount,
        vat15: sales.vat15,
        discountAmount: sales.discountAmount,
        discountPercentage: sales.discountPercentage,
        unitSalesPrice: sales.unitSalesPrice,
      })
      .from(sales)
      .leftJoin(customers, eq(sales.customerId, customers.id))
      .leftJoin(stock, eq(sales.stockId, stock.id))
      .where(
        and(
          sql`${sales.discountAmount} IS NOT NULL`,
          sql`CAST(${sales.discountAmount} AS NUMERIC) > 0`
        )
      )
      .orderBy(sql`${sales.createdAt} DESC`);

      const formattedReport = discountReport.map(row => {
        const discAmt = parseFloat(row.discountAmount || "0");
        const discPct = parseFloat(row.discountPercentage || "0");
        const amt = parseFloat(row.amount || "0");
        const vat = parseFloat(row.vat15 || "0");
        const finalPriceTTC = amt + vat;
        const originalPriceTTC = finalPriceTTC + discAmt;

        return {
          saleId: row.saleId,
          createdAt: row.createdAt,
          customerName: row.customerName || "Client inconnu",
          customerIdNumber: row.customerIdNumber || "",
          itemBarcode: row.itemBarcode || "N/A",
          itemDetails: row.itemDetails || "N/A",
          originalPriceTTC: originalPriceTTC.toFixed(2),
          finalPriceTTC: finalPriceTTC.toFixed(2),
          discountAmount: discAmt.toFixed(2),
          discountPercentage: discPct.toFixed(2),
        };
      });

      const totalDiscounts = formattedReport.reduce((sum, row) => sum + parseFloat(row.discountAmount), 0);

      res.json({
        data: formattedReport,
        summary: {
          totalDiscounts: totalDiscounts.toFixed(2),
          count: formattedReport.length
        }
      });
    } catch (error) {
      console.error("Discount Report Error:", error);
      res.status(500).json({ error: "Failed to fetch discount report" });
    }
  });
}
