import jwt from 'jsonwebtoken';
import { JWTPayload } from './types';
import crypto from 'crypto';

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production';

const ACCESS_TOKEN_EXPIRY = '15m';   // 15 minutes (industry standard)
const REFRESH_TOKEN_EXPIRY = '30d';  // 30 days

/**
 * Generate access token (short-lived, 15 minutes)
 */
export function generateAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    algorithm: 'HS256'
  });
}

/**
 * Generate refresh token (long-lived, 30 days)
 */
export function generateRefreshToken(payload: JWTPayload): string {
  // Add random jti (JWT ID) for unique token identification
  const tokenPayload = {
    ...payload,
    jti: crypto.randomBytes(16).toString('hex')
  };

  return jwt.sign(tokenPayload, JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
    algorithm: 'HS256'
  });
}

/**
 * Verify access token
 */
export function verifyAccessToken(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired access token');
  }
}

/**
 * Verify refresh token
 */
export function verifyRefreshToken(token: string): JWTPayload & { jti: string } {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as JWTPayload & { jti: string };
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
}

/**
 * Generate random secure token (for CSRF protection)
 */
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
