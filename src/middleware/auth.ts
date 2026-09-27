import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/index';
import { rolesPermissions, users } from '../db/schema';
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

/**
 * Accepts only "Authorization: Bearer <token>" (never a query string, which
 * ends up in logs and browser history). The user is re-read from the database
 * on every request, so a role change, deletion or logout takes effect
 * immediately instead of when the token expires.
 */
export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) return res.status(401).json({ error: 'Access token required' });

  let payload: any;
  try {
    payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  try {
    const [user] = await db.select({
      id: users.id,
      username: users.username,
      role: users.role,
      tokenVersion: users.tokenVersion,
    }).from(users).where(eq(users.id, Number(payload.id))).limit(1);

    if (!user || user.tokenVersion !== (payload.tv ?? 0)) {
      return res.status(401).json({ error: 'Session expired, please sign in again' });
    }
    req.user = { id: user.id, username: user.username, role: user.role };
    next();
  } catch (error) {
    console.error('Auth Error:', error);
    res.status(500).json({ error: 'Internal server error during authentication' });
  }
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
