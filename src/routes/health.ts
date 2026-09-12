import type { Express } from "express";

export function registerHealthRoutes(app: Express) {

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "healthy", timestamp: new Date().toISOString() });
  });

  // --- Auth Endpoints ---
}
