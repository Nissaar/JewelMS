import type { Express } from "express";
import { db } from "../db/index";
import { settings } from "../db/schema";
import { eq } from "drizzle-orm";
import { authenticateToken, requireAdmin } from "../middleware/auth";
import { settingUpdateSchema } from "../lib/schemas";
import { notFound, sendError } from "../lib/errors";

export function registerSettingsRoutes(app: Express) {

  // Settings: readable by any signed-in user (category lists, receipt wording), writable by admins.
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


  app.put("/api/settings/:key", authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const { value } = settingUpdateSchema.parse(req.body);
      const updated = await db.update(settings)
        .set({ value, updatedAt: new Date() })
        .where(eq(settings.key, req.params.key))
        .returning();
      if (updated.length === 0) throw notFound(`Setting ${req.params.key} not found`);
      res.json({ message: `Setting ${req.params.key} updated successfully` });
    } catch (error) {
      sendError(res, error, "Failed to update setting");
    }
  });

}
