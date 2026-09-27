import type { Express } from "express";
import { db } from "../db/index";
import { stock, customers, receipts, orders, sales, odf, odfItems } from "../db/schema";
import { eq, or, ilike, and, sql } from "drizzle-orm";
import { authenticateToken, checkPermission, userCan } from "../middleware/auth";
import { sendError } from "../lib/errors";
import { discountRows, salesByMetalRows, tradeInRows, vatReportRows } from "../services/reportData";
import { escapeLike } from "../lib/sql";
import { isShopToday } from "../lib/time";

export function registerReportsRoutes(app: Express) {

  app.get("/api/reports/dashboard-summary", authenticateToken, checkPermission('reports', 'view'), async (req: any, res) => {
    try {
      // "Today" is the shop's local day, whatever the database session's time zone.
      const [todaySalesRes, newClientsRes, stockCountRes, pendingOrdersRes, recentSalesRes] = await Promise.all([
        db.select({ total: sql<string>`SUM(${sales.amount})` })
          .from(sales)
          .where(and(eq(sales.status, 'Completed'), isShopToday(sales.datetime))),
        
        db.select({ count: sql<number>`COUNT(${customers.id})`.mapWith(Number) })
          .from(customers)
          .where(isShopToday(customers.createdAt)),
        
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
      sendError(res, error, "Failed to fetch dashboard summary", "Dashboard Summary Error");
    }
  });


  // Global search. Each section is only searched, and returned, when the user
  // may see that kind of record.
  app.get("/api/search", authenticateToken, async (req: any, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const searchStr = `%${escapeLike(q)}%`;

    try {
      const [canStock, canCustomers, canSales, canOrders] = await Promise.all([
        userCan(req, 'stock'), userCan(req, 'customers'), userCan(req, 'sales'), userCan(req, 'orders'),
      ]);
      const none = Promise.resolve([]);

      if (!q) {
        const [stockRecent, customersRecent] = await Promise.all([
          canStock ? db.select().from(stock).where(eq(stock.status, 'Disponible')).orderBy(sql`${stock.createdAt} DESC`).limit(20) : none,
          canCustomers ? db.select().from(customers).orderBy(sql`${customers.createdAt} DESC`).limit(20) : none,
        ]);
        return res.json({ stock: stockRecent, customers: customersRecent, receipts: [], orders: [] });
      }

      const [stockResults, customerResults, receiptResults, orderResults] = await Promise.all([
        canStock ? db.select().from(stock).where(
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
        ).limit(20) : none,
        canCustomers ? db.select().from(customers).where(or(ilike(customers.name, searchStr), ilike(customers.idNumber, searchStr))).limit(20) : none,
        canSales ? db.select().from(receipts).where(sql`CAST(${receipts.receiptSerialNumber} AS TEXT) ILIKE ${searchStr}`).limit(20) : none,
        canOrders ? db.select().from(orders).where(sql`CAST(${orders.orderNumber} AS TEXT) ILIKE ${searchStr}`).limit(20) : none,
      ]);

      res.json({ stock: stockResults, customers: customerResults, receipts: receiptResults, orders: orderResults });
    } catch (error) {
      sendError(res, error, "Search failed", "Search Error");
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
      sendError(res, error, "Failed to generate weight report", "Reporting Error");
    }
  });

  app.get("/api/reports/vat", authenticateToken, checkPermission('reports', 'view'), async (req: any, res) => {
    try {
      const data = await vatReportRows(req.query);
      const totalVat = data.reduce((sum: number, row: any) => sum + Number(row.vatAmount), 0);
      res.json({ data, summary: { totalVat: totalVat.toFixed(2) } });
    } catch (error) {
      sendError(res, error, "Failed to fetch VAT report", "VAT Report Error");
    }
  });


  app.get("/api/reports/vat/pdf", authenticateToken, checkPermission('reports', 'view'), async (req: any, res) => {
    const { day, month, year } = req.query;
    try {
      const { generateVatReportPDF } = await import("../services/pdf");
      const doc = await generateVatReportPDF(day?.toString(), month?.toString(), year?.toString());

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=rapport-tva.pdf');

      doc.pipe(res);
      doc.end();
    } catch (error) {
      sendError(res, error, "Failed to generate VAT PDF report", "VAT PDF Generation Error");
    }
  });


  // --- Registre Trade-In (Assay Office) Endpoints ---
  app.get("/api/reports/tradein", authenticateToken, checkPermission('reports', 'view'), async (req: any, res) => {
    try {
      res.json(await tradeInRows(req.query));
    } catch (error) {
      sendError(res, error, "Failed to fetch trade-in ledger report", "Trade-In Ledger Report Error");
    }
  });


  app.get("/api/reports/tradein/pdf", authenticateToken, checkPermission('reports', 'view'), async (req: any, res) => {
    const { startDate, endDate } = req.query;
    try {
      const { generateTradeInReportPDF } = await import("../services/pdf");
      const doc = await generateTradeInReportPDF(startDate?.toString(), endDate?.toString());

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=registre-tradein-${startDate || 'all'}-to-${endDate || 'all'}.pdf`);

      doc.pipe(res);
      doc.end();
    } catch (error) {
      sendError(res, error, "Failed to generate Trade-In PDF report", "Trade-In PDF Generation Error");
    }
  });


  app.get("/api/reports/sales-by-metal/pdf", authenticateToken, checkPermission('reports', 'view'), async (req: any, res) => {
    const { startDate, endDate, metalType, fineness } = req.query;
    try {
      const { generateSalesByMetalReportPDF } = await import("../services/pdf");
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
    } catch (error) {
      sendError(res, error, "Failed to generate Sales by Metal PDF report", "Sales by Metal PDF Generation Error");
    }
  });


  // --- Sales by Metal Report Endpoint ---
  app.get("/api/reports/sales-by-metal", authenticateToken, checkPermission('reports', 'view'), async (req: any, res) => {
    try {
      res.json(await salesByMetalRows(req.query));
    } catch (error) {
      sendError(res, error, "Failed to generate sales by metal report", "Sales by Metal Report Error");
    }
  });


  // --- Discount Report Endpoint ---
  app.get("/api/reports/discounts", authenticateToken, checkPermission('reports', 'view'), async (req: any, res) => {
    try {
      res.json(await discountRows());
    } catch (error) {
      sendError(res, error, "Failed to fetch discount report", "Discount Report Error");
    }
  });
}
