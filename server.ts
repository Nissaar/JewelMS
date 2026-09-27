import "dotenv/config";
import express from "express";
import path from "path";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cors from "cors";
import multer from "multer";
import { runMigrations } from "./src/db/migrations";
import { auditLogger } from "./src/middleware/audit";
import { MAX_IMAGE_BYTES } from "./src/services/storage";

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

const PORT = Number(process.env.PORT) || 3000;

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

  // Uploaded photos are held in memory, checked, then written by the storage
  // service under a random name. Customer files are never served statically.
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 20 },
  });

  // JSON middleware
  app.use(express.json({ limit: '100kb' }));

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
  registerReceiptsRoutes(app);
  registerOdfRoutes(app, upload);
  registerOrdersRoutes(app);
  registerAuditLogsRoutes(app);

  // Errors passed to next() (multer limits, malformed JSON) get a JSON reply
  // instead of Express's default HTML page.
  app.use("/api", (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) return next(err);
    if (err instanceof multer.MulterError) {
      const message = err.code === "LIMIT_FILE_SIZE" ? "La photo dépasse 5 Mo." : `Upload refusé (${err.code}).`;
      return res.status(400).json({ error: message });
    }
    if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON body" });
    if (err?.type === "entity.too.large") return res.status(413).json({ error: "Request body too large" });
    console.error("Unhandled API error:", err);
    res.status(500).json({ error: "Internal server error" });
  });

  // Customer files are only reachable through the authenticated API. The
  // Vite dev server would otherwise serve the uploads folder as static files.
  app.use("/uploads", (req, res) => res.status(404).end());

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    // Imported lazily: vite is a dev dependency and absent from the production image.
    const { createServer: createViteServer } = await import("vite");
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
