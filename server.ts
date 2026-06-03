import express from "express";
import path from "path";
import helmet from "helmet";
import cors from "cors";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import { db } from "./src/db/index";
import { settings, stock, customers, receipts, orders, sales, odf, users, rolesPermissions, auditLogs } from "./src/db/schema";
import { eq, or, ilike, and, sql } from "drizzle-orm";
import { authenticateToken, checkPermission } from "./src/middleware/auth";
import { auditLogger } from "./src/middleware/audit";

async function startServer() {
  // Run one-time database migrations/fixes
  try {
    await db.execute(sql`ALTER TABLE stock DROP CONSTRAINT IF EXISTS stock_category_check;`);
    await db.execute(sql`ALTER TABLE stock ALTER COLUMN category TYPE VARCHAR(100);`);
    await db.execute(sql`ALTER TABLE stock ADD COLUMN IF NOT EXISTS price NUMERIC(15, 2) DEFAULT 0.00;`);
    await db.execute(sql`ALTER TABLE stock ADD COLUMN IF NOT EXISTS price_net NUMERIC(15, 2) DEFAULT 0.00;`);
    await db.execute(sql`ALTER TABLE stock ADD COLUMN IF NOT EXISTS price_vat NUMERIC(15, 2) DEFAULT 0.00;`);
    await db.execute(sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(15, 2);`);
    await db.execute(sql`ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC(5, 2);`);
    await db.execute(sql`ALTER TABLE sales DROP COLUMN IF EXISTS gold_rate;`);
    await db.execute(sql`ALTER TABLE orders DROP COLUMN IF EXISTS gold_rate;`);
    console.log("Database migrations: stock_category_check dropped, category length increased, price added, and gold_rate columns dropped.");
  } catch (err) {
    console.error("Migration error (non-fatal):", err);
  }

  const app = express();
  const PORT = 3000;

  // Security Middleware
  app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for Vite dev server compatibility
  }));
  app.use(cors());

  // Static folder for uploads
  const fs = await import("fs");
  const uploadDirs = ["uploads", "uploads/receipts", "uploads/odf"];
  uploadDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  app.use('/uploads', express.static('uploads'));

  // Multer setup
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname}`);
    },
  });
  const upload = multer({ storage });

  // JSON middleware
  app.use(express.json({ limit: '10kb' }));

  // Audit Logging Middleware
  app.use(auditLogger);

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "healthy", timestamp: new Date().toISOString() });
  });

  // --- Auth Endpoints ---
  app.post("/api/login", async (req, res) => {
    const { username, password, rememberMe } = req.body;
    const { default: bcrypt } = await import("bcryptjs");
    const { default: jwt } = await import("jsonwebtoken");
    const JWT_SECRET = process.env.JWT_SECRET || "your-default-secret";

    try {
      const userArr = await db.select().from(users).where(eq(users.username, username)).limit(1);
      if (userArr.length === 0) return res.status(401).json({ error: "Invalid username or password" });
      const user = userArr[0];

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) return res.status(401).json({ error: "Invalid username or password" });

      const expiresIn = rememberMe ? "7d" : "24h";

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn }
      );

      // Fetch user permissions to include in response for frontend UI filtering
      const permissions = await db.select().from(rolesPermissions).where(eq(rolesPermissions.userId, user.id));

      res.json({
        token,
        user: { 
          id: user.id, 
          username: user.username, 
          role: user.role,
          permissions: permissions.map(p => ({
            functionality: p.functionality,
            canView: p.canView,
            canCreate: p.canCreate,
            canEdit: p.canEdit,
            canDelete: p.canDelete
          }))
        }
      });
    } catch (error) {
      console.error("Login Error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // --- User Management Endpoints (Admin Only) ---
  app.get("/api/users", authenticateToken, async (req: any, res) => {
    if (req.user?.role !== 'Admin') return res.status(403).json({ error: "Admin access required" });
    try {
      const allUsers = await db.select({
        id: users.id,
        username: users.username,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt
      }).from(users);
      res.json(allUsers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.post("/api/users", authenticateToken, async (req: any, res) => {
    if (req.user?.role !== 'Admin') return res.status(403).json({ error: "Admin access required" });
    const { username, email, password, role } = req.body;
    const { default: bcrypt } = await import("bcryptjs");

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = await db.insert(users).values({
        username,
        email,
        passwordHash: hashedPassword,
        role: role || 'User'
      }).returning();
      
      res.status(201).json(newUser[0]);
    } catch (error) {
      console.error("User Creation Error:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.put("/api/users/:id", authenticateToken, async (req: any, res) => {
    if (req.user?.role !== 'Admin') return res.status(403).json({ error: "Admin access required" });
    const { email, role } = req.body;
    const userId = parseInt(req.params.id);

    try {
      const updated = await db.update(users)
        .set({ email, role, updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning();
      
      if (updated.length === 0) return res.status(404).json({ error: "User not found" });
      res.json(updated[0]);
    } catch (error) {
      console.error("User Update Error:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.get("/api/users/:id/permissions", authenticateToken, async (req: any, res) => {
    if (req.user?.role !== 'Admin') return res.status(403).json({ error: "Admin access required" });
    try {
      const permissions = await db.select().from(rolesPermissions).where(eq(rolesPermissions.userId, parseInt(req.params.id)));
      res.json(permissions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch permissions" });
    }
  });

  app.put("/api/users/:id/permissions", authenticateToken, async (req: any, res) => {
    if (req.user?.role !== 'Admin') return res.status(403).json({ error: "Admin access required" });
    const { permissions } = req.body; // Array of { functionality, canView, canCreate, canEdit, canDelete }
    const userId = parseInt(req.params.id);

    try {
      await db.transaction(async (tx) => {
        // Simple approach: delete existing and re-insert
        await tx.delete(rolesPermissions).where(eq(rolesPermissions.userId, userId));
        if (permissions && permissions.length > 0) {
          await tx.insert(rolesPermissions).values(
            permissions.map((p: any) => ({
              userId,
              functionality: p.functionality,
              canView: p.canView || false,
              canCreate: p.canCreate || false,
              canEdit: p.canEdit || false,
              canDelete: p.canDelete || false
            }))
          );
        }
      });
      res.json({ message: "Permissions updated successfully" });
    } catch (error) {
      console.error("Permission Update Error:", error);
      res.status(500).json({ error: "Failed to update permissions" });
    }
  });

  // --- Sales Recording Endpoint ---
  app.post("/api/sales", authenticateToken, checkPermission('sales', 'create'), async (req, res) => {
    const { customerId, barcode, paymentMode, chequeNumber, qty, amount, unitSalesPrice, itemDetails, orderId, discountAmount, discountPercentage } = req.body;

    try {
      const result = await db.transaction(async (tx) => {
        // 1. Fetch item from stock to verify and get details
        const stockItems = await tx.select().from(stock).where(and(eq(stock.barcode, barcode), eq(stock.status, 'Disponible'))).limit(1);
        if (stockItems.length === 0) {
          throw new Error("Item not found in stock or already sold");
        }
        const item = stockItems[0];

        // 2. Calculate VAT (15%)
        const vat = Number(amount) * 0.15;

        // 3. Record the sale
        const newSale = await tx.insert(sales).values({
          customerId,
          stockId: item.id,
          paymentMode,
          chequeNumber,
          qty,
          itemDetails: itemDetails || `${item.barcode || ''} - ${item.category || ''} ${item.subCategory || ''} ${item.metalType ? `(${item.metalType})` : ''}`.trim().replace(/\s+/g, ' '),
          weight: item.weightGrams,
          fineness: item.fineness,
          unitSalesPrice: (unitSalesPrice && unitSalesPrice !== "") ? unitSalesPrice.toString() : null,
          amount: (amount && amount !== "") ? amount.toString() : null,
          discountAmount: (discountAmount !== undefined && discountAmount !== null && discountAmount !== "") ? discountAmount.toString() : null,
          discountPercentage: (discountPercentage !== undefined && discountPercentage !== null && discountPercentage !== "") ? discountPercentage.toString() : null,
          vat15: vat.toFixed(2),
          metalType: item.metalType,
          orderId: orderId || null,
        }).returning();

        // 4. Mark as sold in stock
        await tx.update(stock)
          .set({ status: 'Vendu', soldAt: new Date(), updatedAt: new Date() })
          .where(eq(stock.id, item.id));

        return newSale[0];
      });

      res.status(201).json({ sales_id: result.id, sale: result });
    } catch (error: any) {
      console.error("Sales Recording Error:", error);
      const status = error.message === "Item not found in stock or already sold" ? 404 : 500;
      res.status(status).json({ error: error.message || "Failed to record sale" });
    }
  });

  app.post("/api/sales/:id/cancel", authenticateToken, async (req: any, res) => {
    // Visible only to Admin accounts
    if (req.user?.role !== 'Admin') return res.status(403).json({ error: "Admin access required" });
    
    const saleId = parseInt(req.params.id);

    try {
      await db.transaction(async (tx) => {
        // 1. Get sale record
        const saleRecords = await tx.select().from(sales).where(eq(sales.id, saleId)).limit(1);
        if (saleRecords.length === 0) throw new Error("Vente non trouvée");
        const sale = saleRecords[0];

        if (sale.status === 'Cancelled') throw new Error("La vente est déjà annulée");

        // 2. Update item in stock to 'Disponible'
        if (sale.stockId) {
          await tx.update(stock)
            .set({ 
              status: 'Disponible', 
              soldAt: null, 
              updatedAt: new Date() 
            })
            .where(eq(stock.id, sale.stockId));
        }

        // 3. Update sale status to 'Cancelled'
        await tx.update(sales)
          .set({ status: 'Cancelled' })
          .where(eq(sales.id, saleId));

        // 4. Log to audit trail
        await tx.insert(auditLogs).values({
          userId: req.user.id,
          actionType: 'CANCEL_SALE',
          details: { saleId, stockId: sale.stockId },
          ipAddress: req.ip,
          userAgent: req.get('user-agent')
        });
      });

      res.json({ message: "Vente annulée avec succès. L'article est de nouveau en stock." });
    } catch (error: any) {
      console.error("Sale Cancellation Error:", error);
      res.status(500).json({ error: error.message || "Erreur lors de l'annulation de la vente" });
    }
  });

  // --- Stock Endpoints ---
  app.get("/api/stock/metadata", authenticateToken, async (req, res) => {
    try {
      const meta = await db.select().from(settings).where(ilike(settings.key, 'stock_%'));
      const guarantee = await db.select().from(settings).where(eq(settings.key, 'guarantee_options')).limit(1);
      res.json([...meta, ...guarantee]);
    } catch (error) {
      console.error("Stock Metadata Error:", error);
      res.status(500).json({ error: "Failed to fetch stock metadata" });
    }
  });

  app.get("/api/stock", authenticateToken, checkPermission('stock', 'view'), async (req, res) => {
    try {
      const items = await db.select().from(stock).where(eq(stock.status, 'Disponible'));
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stock" });
    }
  });

  app.get("/api/stock/sold", authenticateToken, checkPermission('reports', 'view'), async (req, res) => {
    try {
      const items = await db.select({
        id: stock.id,
        barcode: stock.barcode,
        category: stock.category,
        subCategory: stock.subCategory,
        metalType: stock.metalType,
        weightGrams: stock.weightGrams,
        soldAt: stock.soldAt,
        customerName: customers.name,
        price: sales.amount
      })
      .from(stock)
      .leftJoin(sales, eq(stock.id, sales.stockId))
      .leftJoin(customers, eq(sales.customerId, customers.id))
      .where(eq(stock.status, 'Vendu'))
      .orderBy(sql`${stock.soldAt} DESC`);
      res.json(items);
    } catch (error) {
      console.error("Sold Stock Error:", error);
      res.status(500).json({ error: "Failed to fetch sold items" });
    }
  });

  app.get("/api/stock/autocomplete", authenticateToken, async (req, res) => {
    const { q } = req.query;
    
    try {
      let queryBuilder = db.select().from(stock).where(eq(stock.status, 'Disponible'));
      
      if (q && typeof q === 'string' && q.length >= 2) {
        const searchStr = `%${q}%`;
        queryBuilder = db.select().from(stock).where(
          and(
            eq(stock.status, 'Disponible'),
            or(
              ilike(stock.barcode, searchStr),
              ilike(stock.category, searchStr),
              ilike(stock.subCategory, searchStr)
            )
          )
        );
      }
      
      const results = await queryBuilder
        .orderBy(sql`${stock.createdAt} DESC`)
        .limit(10);
        
      res.json(results);
    } catch (error) {
      console.error("Autocomplete Error:", error);
      res.status(500).json({ error: "Failed to search stock" });
    }
  });

  app.get("/api/stock/:barcode", authenticateToken, checkPermission('stock', 'view'), async (req, res) => {
    try {
      const item = await db.select().from(stock)
        .where(and(eq(stock.barcode, req.params.barcode), eq(stock.status, 'Disponible')))
        .limit(1);
      if (item.length === 0) return res.status(404).json({ error: "Stock item not found or already sold" });
      res.json(item[0]);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stock item" });
    }
  });

  app.post("/api/stock", authenticateToken, checkPermission('stock', 'create'), async (req, res) => {
    try {
      const payload = { ...req.body };
      // Sanitize numeric fields that might be empty strings from frontend
      if (payload.weightGrams === "") payload.weightGrams = null;
      if (payload.yearsOfGuarantee === "") payload.yearsOfGuarantee = null;
      if (payload.fineness === "") payload.fineness = null;
      if (payload.price === "" || payload.price === undefined || payload.price === null) {
        payload.price = "0.00";
        payload.priceNet = "0.00";
        payload.priceVat = "0.00";
      } else {
        const priceNum = parseFloat(payload.price);
        const priceNet = priceNum / 1.15;
        const priceVat = priceNum - priceNet;
        payload.priceNet = priceNet.toFixed(2);
        payload.priceVat = priceVat.toFixed(2);
        payload.price = priceNum.toFixed(2);
      }
      
      const newItem = await db.insert(stock).values(payload).returning();
      res.status(201).json(newItem[0]);
    } catch (error: any) {
      if (error.code === '23505') {
        return res.status(400).json({ message: "Ce code-barres existe déjà." });
      }
      res.status(500).json({ error: "Failed to create stock item" });
    }
  });

  app.put("/api/stock/:id", authenticateToken, checkPermission('stock', 'edit'), async (req, res) => {
    try {
      const payload = { ...req.body };
      // Sanitize numeric fields that might be empty strings from frontend
      if (payload.weightGrams === "") payload.weightGrams = null;
      if (payload.yearsOfGuarantee === "") payload.yearsOfGuarantee = null;
      if (payload.fineness === "") payload.fineness = null;
      if (payload.price === "" || payload.price === undefined || payload.price === null) {
        payload.price = "0.00";
        payload.priceNet = "0.00";
        payload.priceVat = "0.00";
      } else {
        const priceNum = parseFloat(payload.price);
        const priceNet = priceNum / 1.15;
        const priceVat = priceNum - priceNet;
        payload.priceNet = priceNet.toFixed(2);
        payload.priceVat = priceVat.toFixed(2);
        payload.price = priceNum.toFixed(2);
      }

      const updated = await db.update(stock)
        .set({ ...payload, updatedAt: new Date() })
        .where(eq(stock.id, parseInt(req.params.id)))
        .returning();
      if (updated.length === 0) return res.status(404).json({ error: "Stock item not found" });
      res.json(updated[0]);
    } catch (error) {
      res.status(500).json({ error: "Failed to update stock item" });
    }
  });

  app.delete("/api/stock/:id", authenticateToken, checkPermission('stock', 'delete'), async (req, res) => {
    try {
      await db.delete(stock).where(eq(stock.id, parseInt(req.params.id)));
      res.json({ message: "Stock item deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete stock item" });
    }
  });

  // --- KYC / Customer Endpoints ---
  app.get("/api/customers", authenticateToken, checkPermission('customers', 'view'), async (req, res) => {
    const { search } = req.query;
    try {
      let query = db.select().from(customers);
      if (search) {
        const searchStr = `%${search}%`;
        // Use a conditional or if search is provided
        // Drizzle ilike needs to be handled
        const results = await db.select().from(customers).where(
          or(
            ilike(customers.name, searchStr),
            ilike(customers.idNumber, searchStr)
          )
        );
        return res.json(results);
      }
      const allCustomers = await query;
      res.json(allCustomers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  app.post("/api/customers", authenticateToken, checkPermission('customers', 'create'), async (req, res) => {
    try {
      const newCustomer = await db.insert(customers).values(req.body).returning();
      res.status(201).json(newCustomer[0]);
    } catch (error: any) {
      if (error.code === '23505') {
        return res.status(400).json({ message: "Ce client existe déjà." });
      }
      res.status(500).json({ error: "Failed to create customer profile" });
    }
  });

  app.put("/api/customers/:id", authenticateToken, checkPermission('customers', 'edit'), async (req, res) => {
    try {
      const updated = await db.update(customers)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(customers.id, parseInt(req.params.id)))
        .returning();
      if (updated.length === 0) return res.status(404).json({ error: "Customer not found" });
      res.json(updated[0]);
    } catch (error) {
      res.status(500).json({ error: "Failed to update customer" });
    }
  });

  app.get("/api/customers/:id/history", authenticateToken, checkPermission('customers', 'view'), async (req, res) => {
    const customerId = parseInt(req.params.id);
    try {
      const [customerReceipts, customerOrders, customerOdfs] = await Promise.all([
        db.select({
          id: sales.id,
          receiptId: receipts.id,
          receiptNo: receipts.receiptSerialNumber,
          date: sales.datetime,
          amount: sales.amount,
          itemDetails: sales.itemDetails,
          barcode: stock.barcode,
          category: stock.category,
          subCategory: stock.subCategory,
          fileUrl: receipts.fileUrl
        })
        .from(sales)
        .leftJoin(receipts, eq(sales.id, receipts.saleId))
        .leftJoin(stock, eq(sales.stockId, stock.id))
        .where(eq(sales.customerId, customerId))
        .orderBy(sql`${sales.datetime} DESC`),

        db.select()
        .from(orders)
        .where(eq(orders.customerId, customerId)),

        db.select()
        .from(odf)
        .where(eq(odf.customerId, customerId))
      ]);

      res.json({
        receipts: customerReceipts,
        orders: customerOrders,
        odf: customerOdfs
      });
    } catch (error) {
      console.error("Customer History Error:", error);
      res.status(500).json({ error: "Failed to fetch customer history" });
    }
  });

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
          db.select().from(stock).where(eq(stock.status, 'Disponible')).orderBy(sql`${stock.createdAt} DESC`).limit(5),
          db.select().from(customers).orderBy(sql`${customers.createdAt} DESC`).limit(5)
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
            or(ilike(stock.barcode, searchStr), ilike(stock.serialNumber, searchStr))
          )
        ).limit(10),
        db.select().from(customers).where(or(ilike(customers.name, searchStr), ilike(customers.idNumber, searchStr))).limit(10),
        db.select().from(receipts).where(sql`CAST(${receipts.receiptSerialNumber} AS TEXT) ILIKE ${searchStr}`).limit(10),
        db.select().from(orders).where(sql`CAST(${orders.orderNumber} AS TEXT) ILIKE ${searchStr}`).limit(10)
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
  app.get("/api/settings", authenticateToken, async (req, res) => {
    try {
      const allSettings = await db.select().from(settings);
      res.json(allSettings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.get("/api/settings/:key", authenticateToken, async (req, res) => {
    try {
      const setting = await db.select().from(settings).where(eq(settings.key, req.params.key)).limit(1);
      if (setting.length === 0) return res.status(404).json({ error: "Setting not found" });
      res.json(setting[0]);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch setting" });
    }
  });

  app.put("/api/settings/:key", authenticateToken, async (req: any, res) => {
    if (req.user?.role !== 'Admin') return res.status(403).json({ error: "Admin access required" });
    
    const { value } = req.body;
    try {
      await db.update(settings)
        .set({ value, updatedAt: new Date() })
        .where(eq(settings.key, req.params.key));
      res.json({ message: `Setting ${req.params.key} updated successfully` });
    } catch (error) {
      res.status(500).json({ error: "Failed to update setting" });
    }
  });

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
          const { getReceiptFromStorage } = await import("./src/services/storageService");
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
      const { generateReceiptPDF } = await import("./src/services/pdfService");
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

  app.post("/api/receipts/:saleId/upload", authenticateToken, async (req, res) => {
    try {
      const { saleId } = req.params;
      const sId = parseInt(saleId);
      const { generateReceiptPDF, getPDFBuffer } = await import("./src/services/pdfService");
      const { uploadReceiptToStorage } = await import("./src/services/storageService");
      const { sanitize } = await import("./src/lib/utils");
      
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

  // --- Notification Router / Sending Utility ---
  const checkNotificationConfig = (method: 'whatsapp' | 'email' | 'both') => {
    const hasWhatsApp = process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID;
    const hasEmail = process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL;

    if (method === 'whatsapp' && !hasWhatsApp) return false;
    if (method === 'email' && !hasEmail) return false;
    if (method === 'both' && (!hasWhatsApp || !hasEmail)) return false;
    
    return true;
  };

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
      if (receiptArr.length === 0) return res.status(404).json({ error: "Receipt not found. Generate it first." });
      const receipt = receiptArr[0];

      if (!receipt.fileUrl) return res.status(400).json({ error: "Receipt has not been uploaded to storage yet." });

      const customerArr = sale.customerId 
        ? await db.select().from(customers).where(eq(customers.id, sale.customerId)).limit(1)
        : [];
      const customer = customerArr[0];

      if (!customer) return res.status(404).json({ error: "Customer info required for sending receipt." });

      const results: any = {};

      if (method === 'whatsapp' || method === 'both') {
        const { sendWhatsAppReceipt } = await import("./src/services/whatsappService");
        results.whatsapp = await sendWhatsAppReceipt(customer.phoneNumber || '', receipt.fileUrl, receipt.receiptSerialNumber.toString());
      }

      if (method === 'email' || method === 'both') {
        const { sendEmailReceipt } = await import("./src/services/emailService");
        results.email = await sendEmailReceipt(customer.email || '', customer.name, receipt.fileUrl, receipt.receiptSerialNumber.toString());
      }

      res.json({ message: "Send operations completed", results });
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
      if (receiptArr.length === 0) return res.status(404).json({ error: "Receipt not found. Generate it first." });
      const receipt = receiptArr[0];

      if (!receipt.fileUrl) return res.status(400).json({ error: "Receipt has not been uploaded to storage yet." });

      const customerArr = sale.customerId 
        ? await db.select().from(customers).where(eq(customers.id, sale.customerId)).limit(1)
        : [];
      const customer = customerArr[0];

      if (!customer) return res.status(404).json({ error: "Customer info required for sending receipt." });

      const results: any = {};

      if (method === 'whatsapp' || method === 'both') {
        if (customer.phoneNumber) {
          const { sendWhatsAppReceipt } = await import("./src/services/whatsappService");
          results.whatsapp = await sendWhatsAppReceipt(customer.phoneNumber, receipt.fileUrl, receipt.receiptSerialNumber.toString());
        } else {
          results.whatsapp = "Phone number missing for customer";
        }
      }

      if (method === 'email' || method === 'both') {
        if (customer.email) {
          const { sendEmailReceipt } = await import("./src/services/emailService");
          results.email = await sendEmailReceipt(customer.email, customer.name, receipt.fileUrl, receipt.receiptSerialNumber.toString());
        } else {
          results.email = "Email missing for customer";
        }
      }

      res.json({ message: "Send operations completed", results });
    } catch (error: any) {
      console.error("Send Error:", error);
      res.status(500).json({ error: error.message || "Failed to send receipt" });
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
          const { getODFFromStorage } = await import("./src/services/storageService");
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
      const { generateODFPDF } = await import("./src/services/pdfService");
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
      const { generateODFPDF, getPDFBuffer } = await import("./src/services/pdfService");
      const { uploadODFToStorage } = await import("./src/services/storageService");
      const { sanitize } = await import("./src/lib/utils");
      
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
      const record = odfArr[0];

      if (!record.fileUrl) return res.status(400).json({ error: "ODF document has not been uploaded to storage yet." });

      const customerArr = record.customerId 
        ? await db.select().from(customers).where(eq(customers.id, record.customerId)).limit(1)
        : [];
      const customer = customerArr[0];

      if (!customer) return res.status(404).json({ error: "Customer info required for sending ODF." });

      const results: any = {};

      if (method === 'whatsapp' || method === 'both') {
        if (customer.phoneNumber) {
          const { sendWhatsAppODF } = await import("./src/services/whatsappService");
          results.whatsapp = await sendWhatsAppODF(customer.phoneNumber, record.fileUrl, record.odfSerialNumber.toString());
        } else {
          results.whatsapp = "Phone number missing for customer";
        }
      }

      if (method === 'email' || method === 'both') {
        if (customer.email) {
          const { sendEmailODF } = await import("./src/services/emailService");
          results.email = await sendEmailODF(customer.email, customer.name, record.fileUrl, record.odfSerialNumber.toString());
        } else {
          results.email = "Email missing for customer";
        }
      }

      res.json({ message: "ODF sending operations completed", results });
    } catch (error: any) {
      console.error("ODF Send Error:", error);
      res.status(500).json({ error: error.message || "Failed to send ODF" });
    }
  });

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
      const { generateVatReportPDF } = await import("./src/services/pdfService");
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

  app.get("/api/sales/history", authenticateToken, async (req, res) => {
    try {
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
      .orderBy(sql`${sales.datetime} DESC`);

      res.json(history);
    } catch (error) {
      console.error("Sales History Error:", error);
      res.status(500).json({ error: "Failed to fetch sales history" });
    }
  });

  app.get("/api/audit-logs", authenticateToken, async (req: any, res) => {
    if (req.user?.role !== 'Admin') return res.status(403).json({ error: "Admin access required" });
    try {
      const logs = await db.select({
        id: auditLogs.id,
        userId: auditLogs.userId,
        username: users.username,
        action: auditLogs.actionType,
        details: auditLogs.details,
        createdAt: auditLogs.timestamp
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .orderBy(auditLogs.timestamp);

      res.json(logs);
    } catch (error) {
      console.error("Audit Logs Error:", error);
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

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
        parameters: odf.parameters,
        comments: odf.comments,
        imageUrl: odf.imageUrl,
        createdAt: odf.createdAt
      })
      .from(odf)
      .innerJoin(customers, eq(odf.customerId, customers.id))
      .orderBy(odf.createdAt);
      res.json(allOdf);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch ODF records" });
    }
  });

  app.post("/api/odf", authenticateToken, checkPermission('odf', 'create'), upload.single('image'), async (req: any, res) => {
    const { customerId, metalType, fineness, weight, amount, itemReservedRepair, description, parameters, comments, createdAt, fileUrl } = req.body;
    let imageUrl = null;

    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
    }

    try {
      const newOdf = await db.insert(odf).values({
        customerId: customerId ? parseInt(customerId) : null,
        metalType,
        fineness: (fineness && fineness !== "") ? fineness : null,
        weight: (weight && weight !== "") ? weight : null,
        amount: (amount && amount !== "") ? amount : null,
        itemReservedRepair,
        description,
        parameters,
        comments,
        imageUrl,
        fileUrl,
        date: createdAt ? new Date(createdAt) : new Date(),
        createdAt: createdAt ? new Date(createdAt) : new Date()
      }).returning();

      res.status(201).json({
        id: newOdf[0].id,
        ...newOdf[0]
      });
    } catch (error) {
      console.error("ODF Creation Error:", error);
      res.status(500).json({ error: "Failed to create ODF record" });
    }
  });

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

      const { generateBookingReceiptPDF } = await import("./src/services/pdfService");
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

  app.post("/api/orders/:id/finalize", authenticateToken, async (req: any, res) => {
    const { finalWeight, finalPrice, paymentMode } = req.body;
    const orderId = parseInt(req.params.id);

    try {
      await db.transaction(async (tx: any) => {
        const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
        if (!order) throw new Error("Order not found");

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
      console.error("Order Finalization Error:", error);
      res.status(500).json({ error: "Failed to finalize order" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Error starting server:", err);
  process.exit(1);
});
