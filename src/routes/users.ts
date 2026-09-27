import type { Express } from "express";
import { db } from "../db/index";
import { users, rolesPermissions } from "../db/schema";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { authenticateToken, requireAdmin, type AuthRequest } from "../middleware/auth";
import { idParam, passwordResetSchema, permissionsUpdateSchema, userCreateSchema, userUpdateSchema } from "../lib/schemas";
import { badRequest, notFound, sendError } from "../lib/errors";

// Columns safe to return: never the password hash or token version.
const publicUser = {
  id: users.id,
  username: users.username,
  email: users.email,
  role: users.role,
  createdAt: users.createdAt,
};

const uniqueViolation = (error: any) => error?.code === '23505' || error?.cause?.code === '23505';

export function registerUsersRoutes(app: Express) {

  app.get("/api/users", authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
    try {
      res.json(await db.select(publicUser).from(users));
    } catch (error) {
      sendError(res, error, "Failed to fetch users");
    }
  });

  app.post("/api/users", authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { username, email, password, role } = userCreateSchema.parse(req.body);
      const [newUser] = await db.insert(users).values({
        username,
        email,
        passwordHash: await bcrypt.hash(password, 10),
        role,
      }).returning(publicUser);
      res.status(201).json(newUser);
    } catch (error) {
      if (uniqueViolation(error)) return res.status(400).json({ error: "Ce nom d'utilisateur ou cet email existe déjà." });
      sendError(res, error, "Failed to create user", "User Creation Error");
    }
  });

  app.put("/api/users/:id", authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const userId = idParam.parse(req.params.id);
      const input = userUpdateSchema.parse(req.body);

      const updated = await db.transaction(async (tx) => {
        const [current] = await tx.select().from(users).where(eq(users.id, userId)).limit(1).for('update');
        if (!current) throw notFound("User not found");

        const roleChanged = input.role !== undefined && input.role !== current.role;
        if (roleChanged && current.role === 'Admin') {
          const [{ admins }] = await tx.select({ admins: sql<number>`count(*)::int` }).from(users).where(eq(users.role, 'Admin'));
          if (admins <= 1) throw badRequest("Impossible de retirer le rôle Admin au dernier administrateur.");
        }

        const [row] = await tx.update(users)
          .set({
            ...input,
            updatedAt: new Date(),
            // A role change signs the user out so their next login carries it.
            ...(roleChanged ? { tokenVersion: sql`${users.tokenVersion} + 1` } : {}),
          })
          .where(eq(users.id, userId))
          .returning(publicUser);
        return row;
      });
      res.json(updated);
    } catch (error) {
      if (uniqueViolation(error)) return res.status(400).json({ error: "Cet email est déjà utilisé." });
      sendError(res, error, "Failed to update user", "User Update Error");
    }
  });

  app.post("/api/users/:id/reset-password", authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const userId = idParam.parse(req.params.id);
      const { password } = passwordResetSchema.parse(req.body);
      const [updated] = await db.update(users)
        .set({
          passwordHash: await bcrypt.hash(password, 10),
          tokenVersion: sql`${users.tokenVersion} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
        .returning(publicUser);
      if (!updated) throw notFound("User not found");
      res.json({ message: "Mot de passe réinitialisé. L'utilisateur doit se reconnecter." });
    } catch (error) {
      sendError(res, error, "Failed to reset password", "Password Reset Error");
    }
  });

  app.get("/api/users/:id/permissions", authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const permissions = await db.select().from(rolesPermissions).where(eq(rolesPermissions.userId, idParam.parse(req.params.id)));
      res.json(permissions);
    } catch (error) {
      sendError(res, error, "Failed to fetch permissions");
    }
  });


  app.put("/api/users/:id/permissions", authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const userId = idParam.parse(req.params.id);
      const { permissions } = permissionsUpdateSchema.parse(req.body);
      await db.transaction(async (tx) => {
        // Simple approach: delete existing and re-insert
        await tx.delete(rolesPermissions).where(eq(rolesPermissions.userId, userId));
        if (permissions && permissions.length > 0) {
          await tx.insert(rolesPermissions).values(
            permissions.map(p => ({ userId, ...p }))
          );
        }
      });
      res.json({ message: "Permissions updated successfully" });
    } catch (error) {
      sendError(res, error, "Failed to update permissions", "Permission Update Error");
    }
  });

}
