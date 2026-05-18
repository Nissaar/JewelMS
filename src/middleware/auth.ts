import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/index'; // I'll need to create src/db/index.ts to export db
import { users, rolesPermissions } from '../db/schema';
import { eq, and } from 'drizzle-orm';

const JWT_SECRET = process.env.JWT_SECRET || 'your-default-secret';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    role: string;
  };
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

export const checkPermission = (functionality: string, action: 'view' | 'create' | 'edit' | 'delete') => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    // Admins have all permissions
    if (req.user.role === 'Admin') return next();

    // Check granular permissions for non-admins
    try {
      const permission = await db
        .select()
        .from(rolesPermissions)
        .where(
          and(
            eq(rolesPermissions.userId, req.user.id),
            eq(rolesPermissions.functionality, functionality)
          )
        )
        .limit(1);

      if (permission.length === 0) {
        return res.status(403).json({ error: 'Permission denied: No access configured for this functionality' });
      }

      const hasAccess = (() => {
        switch (action) {
          case 'view': return permission[0].canView;
          case 'create': return permission[0].canCreate;
          case 'edit': return permission[0].canEdit;
          case 'delete': return permission[0].canDelete;
          default: return false;
        }
      })();

      if (!hasAccess) {
        return res.status(403).json({ error: `Permission denied: Cannot ${action} ${functionality}` });
      }

      next();
    } catch (error) {
      console.error('RBAC Error:', error);
      res.status(500).json({ error: 'Internal server error during permission check' });
    }
  };
};
