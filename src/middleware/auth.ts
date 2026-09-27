import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/index';
import { rolesPermissions } from '../db/schema';
import { eq } from 'drizzle-orm';
import { JWT_SECRET } from '../config';
import { hasPermission, type Functionality, type PermissionAction, type PermissionRow, type PermissionSubject, type Requirement } from '../shared/permissions';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: string;
  };
  permissions?: PermissionRow[];
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];

  // Also support token in query params for direct links like PDF views
  if (!token && req.query.token) {
    token = req.query.token as string;
  }

  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

/** The caller's permission rows, loaded once per request. */
async function loadSubject(req: AuthRequest): Promise<PermissionSubject> {
  if (!req.user) throw new Error('loadSubject called before authenticateToken');
  if (req.user.role === 'Admin') return { role: 'Admin' };
  if (!req.permissions) {
    req.permissions = await db.select().from(rolesPermissions).where(eq(rolesPermissions.userId, req.user.id));
  }
  return { role: req.user.role, permissions: req.permissions };
}

/**
 * Allows the request when the user holds at least one of the given
 * permissions. Admins always pass.
 */
export const checkAnyPermission = (...requirements: Requirement[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const subject = await loadSubject(req);
      if (requirements.some(([f, a]) => hasPermission(subject, f, a))) return next();
      const [f, a] = requirements[0];
      return res.status(403).json({ error: `Permission denied: Cannot ${a} ${f}` });
    } catch (error) {
      console.error('RBAC Error:', error);
      res.status(500).json({ error: 'Internal server error during permission check' });
    }
  };
};

export const checkPermission = (functionality: Functionality, action: PermissionAction) =>
  checkAnyPermission([functionality, action]);

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'Admin') return res.status(403).json({ error: 'Admin access required' });
  next();
};

/** Whether the authenticated user holds a permission (for filtering results). */
export async function userCan(req: AuthRequest, functionality: Functionality, action: PermissionAction = 'view') {
  return hasPermission(await loadSubject(req), functionality, action);
}
