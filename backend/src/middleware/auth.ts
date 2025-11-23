import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../auth';
import { JWTPayload } from '../types';

// Extend Express Request to include user (override Express.User type)
declare global {
  namespace Express {
    interface User extends JWTPayload {}
  }
}

/**
 * Middleware to require authentication on protected routes
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    // Try to get token from Authorization header or cookie
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : req.cookies?.access_token;

    if (!token) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    }

    // Verify token
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token'
      }
    });
  }
}

/**
 * Optional auth middleware - doesn't fail if no token
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : req.cookies?.access_token;

    if (token) {
      const payload = verifyAccessToken(token);
      req.user = payload;
    }
  } catch (error) {
    // Ignore errors for optional auth
  }
  next();
}
