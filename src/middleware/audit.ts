import { Response, NextFunction } from 'express';
import { db } from '../db/index';
import { auditLogs } from '../db/schema';
import { AuthRequest } from './auth';

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
          body: req.body,
          query: req.query,
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
