import type { Express } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { db } from "../db/index";
import { users, rolesPermissions } from "../db/schema";
import { eq, sql } from "drizzle-orm";
import { JWT_SECRET } from "../config";
import { authenticateToken, type AuthRequest } from "../middleware/auth";
import { sendError } from "../lib/errors";
import type { RateLimitRequestHandler } from "express-rate-limit";

const loginSchema = z.object({
  username: z.string().trim().min(1).max(50),
  password: z.string().min(1).max(200),
  rememberMe: z.boolean().optional(),
});

// Compared against when the username doesn't exist, so a wrong username takes
// as long as a wrong password and usernames can't be probed by timing.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

async function permissionsFor(userId: number) {
  const rows = await db.select().from(rolesPermissions).where(eq(rolesPermissions.userId, userId));
  return rows.map((p: any) => ({
    functionality: p.functionality,
    canView: p.canView,
    canCreate: p.canCreate,
    canEdit: p.canEdit,
    canDelete: p.canDelete,
  }));
}

export function registerAuthRoutes(app: Express, loginLimiter: RateLimitRequestHandler) {

  app.post(["/api/login", "/api/auth/login"], loginLimiter, async (req, res) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) return res.status(401).json({ error: "Invalid username or password" });
      const { username, password, rememberMe } = parsed.data;

      const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
      const isMatch = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
      if (!user || !isMatch) return res.status(401).json({ error: "Invalid username or password" });

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role, tv: user.tokenVersion },
        JWT_SECRET,
        { expiresIn: rememberMe ? "30d" : "8h", algorithm: "HS256" }
      );

      res.json({
        token,
        user: { id: user.id, username: user.username, role: user.role, permissions: await permissionsFor(user.id) }
      });
    } catch (error) {
      sendError(res, error, "Login failed", "Login Error");
    }
  });

  /** The signed-in user with current role and permissions (refreshed by the app on load). */
  app.get("/api/auth/me", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { id, username, role } = req.user!;
      res.json({ user: { id, username, role, permissions: await permissionsFor(id) } });
    } catch (error) {
      sendError(res, error, "Failed to load user");
    }
  });

  /** Signs the user out everywhere: every token issued so far stops working. */
  app.post("/api/logout", authenticateToken, async (req: AuthRequest, res) => {
    try {
      await db.update(users)
        .set({ tokenVersion: sql`${users.tokenVersion} + 1` })
        .where(eq(users.id, req.user!.id));
      res.json({ message: "Signed out" });
    } catch (error) {
      sendError(res, error, "Logout failed");
    }
  });
}
