import express from "express";
import path from "path";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cors from "cors";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import { runMigrations } from "./src/db/migrations";
import { auditLogger } from "./src/middleware/audit";

import { registerHealthRoutes } from "./src/routes/health";
import { registerAuthRoutes } from "./src/routes/auth";
import { registerUsersRoutes } from "./src/routes/users";
import { registerSalesRoutes } from "./src/routes/sales";
import { registerStockRoutes } from "./src/routes/stock";
import { registerCustomersRoutes } from "./src/routes/customers";
import { registerReportsRoutes } from "./src/routes/reports";
import { registerSettingsRoutes } from "./src/routes/settings";
import { registerReceiptsRoutes } from "./src/routes/receipts";
import { registerOdfRoutes } from "./src/routes/odf";
import { registerOrdersRoutes } from "./src/routes/orders";
import { registerAuditLogsRoutes } from "./src/routes/auditLogs";

const PORT = 3000;

async function startServer() {
  await runMigrations();

  const app = express();

  // Security Middleware
  app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for Vite dev server compatibility
  }));

  // The frontend is served from this same origin, so cross-origin access is only
  // needed for explicitly configured clients. Requests with no Origin header
  // (same-origin navigations, curl, server-to-server) are always allowed.
  const allowedOrigins = (process.env.CORS_ORIGINS || process.env.APP_URL || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(cors({
    origin(origin, callback) {
      // No Origin header: same-origin navigation, curl, server-to-server.
      if (!origin) return callback(null, true);
      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      // Disallowed: omit the CORS headers and let the browser refuse the read.
      // Never reject with an error — that would turn same-origin asset requests
      // (index.html loads its bundle with `crossorigin`, so they carry an
      // Origin header) into 500s and blank the whole app.
      return callback(null, false);
    },
    credentials: true,
  }));

  // Throttle credential guessing on the login route. Successful logins don't
  // count toward the limit, so a busy shop floor isn't locked out.
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Trop de tentatives de connexion. Réessayez dans quelques minutes." },
  });

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

  // API routes. Registration order matters where a literal path would otherwise
  // be captured by a sibling's `:param` route.
  registerHealthRoutes(app);
  registerAuthRoutes(app, loginLimiter);
  registerUsersRoutes(app);
  registerSalesRoutes(app);
  registerStockRoutes(app);
  registerCustomersRoutes(app);
  registerReportsRoutes(app);
  registerSettingsRoutes(app);
  registerReceiptsRoutes(app, upload);
  registerOdfRoutes(app, upload);
  registerOrdersRoutes(app);
  registerAuditLogsRoutes(app);

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
