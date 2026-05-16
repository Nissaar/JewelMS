import { Response, NextFunction } from 'express';
import { db } from '../db/index';
import { auditLogs } from '../db/schema';
import { AuthRequest } from './auth';

const redactSensitiveData = (data: any): any => {
  if (!data || typeof data !== 'object') return data;

  const sensitiveKeys = ['password', 'token', 'authorization', 'secret', 'passwordhash', 'jwt'];
  
  const redacted = Array.isArray(data) ? [...data] : { ...data };

  for (const key in redacted) {
    if (sensitiveKeys.includes(key.toLowerCase())) {
      redacted[key] = '[REDACTED]';
    } else if (typeof redacted[key] === 'object') {
      redacted[key] = redactSensitiveData(redacted[key]);
    }
  }

  return redacted;
};

export const auditLogger = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const methodsToLog = ['POST', 'PUT', 'DELETE', 'PATCH'];
  
  // Capture the original end function to log after the response is sent
  const originalEnd = res.end;
  
  res.end = function(chunk?: any, encoding?: any, cb?: any) {
    if (methodsToLog.includes(req.method)) {
      const logData = {
        userId: req.user?.id || null,
        actionType: `${req.method} ${req.path}`,
        details: {
          method: req.method,
          path: req.path,
          body: redactSensitiveData(req.body),
          query: redactSensitiveData(req.query),
          headers: redactSensitiveData(req.headers),
          statusCode: res.statusCode
        },
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent']
      };

      // Background logging
      db.insert(auditLogs).values(logData).catch(err => {
        console.error('Failed to save audit log:', err);
      });
    }
    
    return originalEnd.call(this, chunk, encoding, cb);
  } as any;

  next();
};
