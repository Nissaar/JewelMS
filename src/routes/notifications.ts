import type { Express } from "express";
import { z } from "zod";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db/index";
import { notificationLog } from "../db/schema";
import { authenticateToken, userCan, type AuthRequest } from "../middleware/auth";
import { sendError } from "../lib/errors";

const querySchema = z.object({
  kind: z.enum(['receipt', 'odf']),
  refId: z.coerce.number().int().positive(),
  ids: z.string().optional(),
});

export function registerNotificationRoutes(app: Express) {

  /** Delivery status of a receipt's or ODF's sends, newest first (optionally only ?ids=1,2). */
  app.get("/api/notifications", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { kind, refId, ids } = querySchema.parse(req.query);
      if (!(await userCan(req, kind === 'receipt' ? 'sales' : 'odf', 'view'))) {
        return res.status(403).json({ error: 'Permission denied' });
      }
      const idList = ids ? ids.split(',').map(Number).filter(Number.isInteger) : [];
      const rows = await db.select({
        id: notificationLog.id,
        channel: notificationLog.channel,
        recipient: notificationLog.recipient,
        status: notificationLog.status,
        error: notificationLog.error,
        createdAt: notificationLog.createdAt,
        updatedAt: notificationLog.updatedAt,
      })
      .from(notificationLog)
      .where(and(
        eq(notificationLog.kind, kind),
        eq(notificationLog.refId, refId),
        idList.length ? inArray(notificationLog.id, idList) : undefined,
      ))
      .orderBy(desc(notificationLog.id))
      .limit(50);
      res.json(rows);
    } catch (error) {
      sendError(res, error, "Failed to fetch notification status");
    }
  });
}
