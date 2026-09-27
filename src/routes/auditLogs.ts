import type { Express } from "express";
import { db } from "../db/index";
import { users, auditLogs } from "../db/schema";
import { desc, eq, ilike, or, sql } from "drizzle-orm";
import { authenticateToken, requireAdmin } from "../middleware/auth";
import { sendError } from "../lib/errors";
import { escapeLike } from "../lib/sql";
import { parsePage } from "../lib/pagination";

export function registerAuditLogsRoutes(app: Express) {

  /** Newest first, one page at a time; ?q= searches user, action and details. */
  app.get("/api/audit-logs", authenticateToken, requireAdmin, async (req: any, res) => {
    try {
      const { page, pageSize, offset } = parsePage(req.query);
      const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      const pattern = `%${escapeLike(q)}%`;
      const where = q
        ? or(ilike(users.username, pattern), ilike(auditLogs.actionType, pattern), sql`${auditLogs.details}::text ILIKE ${pattern}`)
        : undefined;

      const [items, [{ total }]] = await Promise.all([
        db.select({
          id: auditLogs.id,
          userId: auditLogs.userId,
          username: users.username,
          action: auditLogs.actionType,
          details: auditLogs.details,
          createdAt: auditLogs.timestamp
        })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.userId, users.id))
        .where(where)
        .orderBy(desc(auditLogs.timestamp), desc(auditLogs.id))
        .limit(pageSize)
        .offset(offset),
        db.select({ total: sql<number>`count(*)::int` })
          .from(auditLogs)
          .leftJoin(users, eq(auditLogs.userId, users.id))
          .where(where),
      ]);

      res.json({ items, total, page, pageSize });
    } catch (error) {
      sendError(res, error, "Failed to fetch audit logs", "Audit Logs Error");
    }
  });
}
