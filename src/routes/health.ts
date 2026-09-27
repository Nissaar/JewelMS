import type { Express } from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";

/**
 * Identifies the deployed frontend build: a hash of dist/index.html, which
 * changes whenever a new build is deployed. The app compares it to the value
 * it loaded with and offers a reload when they differ.
 */
function buildVersion(): string {
  try {
    const html = fs.readFileSync(path.join(process.cwd(), "dist", "index.html"));
    return crypto.createHash("sha256").update(html).digest("hex").slice(0, 12);
  } catch {
    return "dev";
  }
}

export function registerHealthRoutes(app: Express) {
  const version = process.env.NODE_ENV === "production" ? buildVersion() : "dev";

  app.get("/api/health", (req, res) => {
    res.json({ status: "healthy", timestamp: new Date().toISOString() });
  });

  app.get("/api/version", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ version });
  });
}
