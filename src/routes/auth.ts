import type { Express } from "express";
import { db } from "../db/index";
import { users, rolesPermissions } from "../db/schema";
import { eq, or } from "drizzle-orm";
import { JWT_SECRET } from "../config";
import type { RateLimitRequestHandler } from "express-rate-limit";

export function registerAuthRoutes(app: Express, loginLimiter: RateLimitRequestHandler) {

  // --- Auth Endpoints ---
  app.post(["/api/login", "/api/auth/login"], loginLimiter, async (req, res) => {
    const { username, password, rememberMe } = req.body;
    const { default: bcrypt } = await import("bcryptjs");
    const { default: jwt } = await import("jsonwebtoken");

    try {
      const userArr = await db.select().from(users).where(eq(users.username, username)).limit(1);
      if (userArr.length === 0) return res.status(401).json({ error: "Invalid username or password" });
      const user = userArr[0];

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) return res.status(401).json({ error: "Invalid username or password" });

      const expiresIn = rememberMe ? "30d" : "8h";

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
        { expiresIn }
      );

      // Fetch user permissions to include in response for frontend UI filtering
      const permissions = await db.select().from(rolesPermissions).where(eq(rolesPermissions.userId, user.id));

      res.json({
        token,
        user: { 
          id: user.id, 
          username: user.username, 
          role: user.role,
          permissions: permissions.map(p => ({
            functionality: p.functionality,
            canView: p.canView,
            canCreate: p.canCreate,
            canEdit: p.canEdit,
            canDelete: p.canDelete
          }))
        }
      });
    } catch (error) {
      console.error("Login Error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // --- User Management Endpoints (Admin Only) ---
}
