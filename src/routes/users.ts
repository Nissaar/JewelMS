import type { Express } from "express";
import { db } from "../db/index";
import { users, rolesPermissions } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { authenticateToken } from "../middleware/auth";

export function registerUsersRoutes(app: Express) {

  // --- User Management Endpoints (Admin Only) ---
  app.get("/api/users", authenticateToken, async (req: any, res) => {
    if (req.user?.role !== 'Admin') return res.status(403).json({ error: "Admin access required" });
    try {
      const allUsers = await db.select({
        id: users.id,
        username: users.username,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt
      }).from(users);
      res.json(allUsers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });


  app.post("/api/users", authenticateToken, async (req: any, res) => {
    if (req.user?.role !== 'Admin') return res.status(403).json({ error: "Admin access required" });
    const { username, email, password, role } = req.body;
    const { default: bcrypt } = await import("bcryptjs");

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = await db.insert(users).values({
        username,
        email,
        passwordHash: hashedPassword,
        role: role || 'User'
      }).returning();
      
      res.status(201).json(newUser[0]);
    } catch (error) {
      console.error("User Creation Error:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });


  app.put("/api/users/:id", authenticateToken, async (req: any, res) => {
    if (req.user?.role !== 'Admin') return res.status(403).json({ error: "Admin access required" });
    const { email, role } = req.body;
    const userId = parseInt(req.params.id);

    try {
      const updated = await db.update(users)
        .set({ email, role, updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning();
      
      if (updated.length === 0) return res.status(404).json({ error: "User not found" });
      res.json(updated[0]);
    } catch (error) {
      console.error("User Update Error:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });


  app.get("/api/users/:id/permissions", authenticateToken, async (req: any, res) => {
    if (req.user?.role !== 'Admin') return res.status(403).json({ error: "Admin access required" });
    try {
      const permissions = await db.select().from(rolesPermissions).where(eq(rolesPermissions.userId, parseInt(req.params.id)));
      res.json(permissions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch permissions" });
    }
  });


  app.put("/api/users/:id/permissions", authenticateToken, async (req: any, res) => {
    if (req.user?.role !== 'Admin') return res.status(403).json({ error: "Admin access required" });
    const { permissions } = req.body; // Array of { functionality, canView, canCreate, canEdit, canDelete }
    const userId = parseInt(req.params.id);

    try {
      await db.transaction(async (tx) => {
        // Simple approach: delete existing and re-insert
        await tx.delete(rolesPermissions).where(eq(rolesPermissions.userId, userId));
        if (permissions && permissions.length > 0) {
          await tx.insert(rolesPermissions).values(
            permissions.map((p: any) => ({
              userId,
              functionality: p.functionality,
              canView: p.canView || false,
              canCreate: p.canCreate || false,
              canEdit: p.canEdit || false,
              canDelete: p.canDelete || false
            }))
          );
        }
      });
      res.json({ message: "Permissions updated successfully" });
    } catch (error) {
      console.error("Permission Update Error:", error);
      res.status(500).json({ error: "Failed to update permissions" });
    }
  });

  // --- Sales Recording Endpoint ---
}
