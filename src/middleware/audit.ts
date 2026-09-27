import { Response, NextFunction } from 'express';
import { db } from '../db/index';
import { auditLogs } from '../db/schema';
import { AuthRequest } from './auth';

const METHODS_TO_LOG = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);

// Never stored.
const SECRET_KEYS = new Set(['password', 'token', 'authorization', 'secret', 'passwordhash', 'jwt']);
// Customer identity: the log records that it was sent or changed, not its value.
const PERSONAL_KEYS = new Set(['name', 'email', 'address', 'phonenumber', 'idnumber']);

const MAX_DEPTH = 5;

function sanitize(data: any, depth = 0): any {
  if (!data || typeof data !== 'object') return data;
  if (depth >= MAX_DEPTH) return '[…]';
  const out: any = Array.isArray(data) ? [] : {};
  for (const [key, value] of Object.entries(data)) {
    const k = key.toLowerCase();
    if (SECRET_KEYS.has(k)) out[key] = '[REDACTED]';
    else if (PERSONAL_KEYS.has(k)) out[key] = value === null || value === '' ? value : '[personal data]';
    else out[key] = sanitize(value, depth + 1);
  }
  return out;
}

/**
 * Records every write request once its response is sent: who, what, the
 * (sanitised) body and the outcome. Request headers are not stored.
 */
export const auditLogger = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!METHODS_TO_LOG.has(req.method)) return next();

  res.on('finish', () => {
    db.insert(auditLogs).values({
      userId: req.user?.id || null,
      actionType: `${req.method} ${req.path}`.slice(0, 255),
      details: {
        method: req.method,
        path: req.path,
        body: sanitize(req.body),
        query: sanitize(req.query),
        statusCode: res.statusCode,
      },
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    }).catch((err: any) => console.error('Failed to save audit log:', err.message));
  });

  next();
};
