import type { Express } from "express";
import { db } from "../db/index";
import { settings } from "../db/schema";
import { eq } from "drizzle-orm";
import { authenticateToken } from "../middleware/auth";

export function registerSettingsRoutes(app: Express) {

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
}
