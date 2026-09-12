import type { Express } from "express";
import { db } from "../db/index";
import { users, auditLogs } from "../db/schema";
import { eq } from "drizzle-orm";
import { authenticateToken } from "../middleware/auth";

export function registerAuditLogsRoutes(app: Express) {

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
}
