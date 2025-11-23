import express, { Request, Response } from 'express';
import passport from 'passport';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../auth';
import { query } from '../db';
import { User, RefreshToken } from '../types';
import { requireAuth } from '../middleware/auth';

const router = express.Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

/**
 * POST /api/auth/google
 * Initiate Google OAuth flow
 */
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
  session: false
}));

/**
 * GET /api/auth/google/callback
 * Google OAuth callback
 */
router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${FRONTEND_URL}/login?error=auth_failed` }),
  async (req: Request, res: Response) => {
    try {
      const user = req.user!; // Express.User (JWTPayload)

      // Generate tokens
      const accessToken = generateAccessToken({
        userId: user.userId,
        email: user.email
      });

      const refreshToken = generateRefreshToken({
        userId: user.userId,
        email: user.email
      });

      // Store refresh token in database
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

      await query(
        `INSERT INTO refresh_tokens (user_id, token, expires_at)
         VALUES ($1, $2, $3)`,
        [user.userId, refreshToken, expiresAt]
      );

      // Set cookies (HttpOnly for security)
      res.cookie('access_token', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000 // 15 minutes
      });

      res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });

      // Redirect to frontend
      res.redirect(`${FRONTEND_URL}/dashboard`);
    } catch (error) {
      console.error('Auth callback error:', error);
      res.redirect(`${FRONTEND_URL}/login?error=server_error`);
    }
  }
);

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.refresh_token || req.body.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        error: {
          code: 'NO_REFRESH_TOKEN',
          message: 'Refresh token required'
        }
      });
    }

    // Verify refresh token
    const payload = verifyRefreshToken(refreshToken);

    // Check if refresh token exists in database and is not expired
    const tokenResult = await query<RefreshToken>(
      `SELECT * FROM refresh_tokens
       WHERE token = $1 AND user_id = $2 AND expires_at > NOW()`,
      [refreshToken, payload.userId]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(401).json({
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Refresh token is invalid or expired'
        }
      });
    }

    // Generate new access token
    const newAccessToken = generateAccessToken({
      userId: payload.userId,
      email: payload.email
    });

    // Optionally rotate refresh token (more secure)
    const newRefreshToken = generateRefreshToken({
      userId: payload.userId,
      email: payload.email
    });

    // Delete old refresh token and insert new one
    await query(
      'DELETE FROM refresh_tokens WHERE token = $1',
      [refreshToken]
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [payload.userId, newRefreshToken, expiresAt]
    );

    // Set new cookies
    res.cookie('access_token', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000
    });

    res.cookie('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    res.json({
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      }
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      error: {
        code: 'REFRESH_FAILED',
        message: 'Failed to refresh token'
      }
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout and revoke refresh token
 */
router.post('/logout', requireAuth, async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.refresh_token;

    if (refreshToken) {
      // Revoke refresh token
      await query(
        'DELETE FROM refresh_tokens WHERE token = $1',
        [refreshToken]
      );
    }

    // Clear cookies
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');

    res.json({
      data: { message: 'Logged out successfully' }
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: {
        code: 'LOGOUT_FAILED',
        message: 'Failed to logout'
      }
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const userResult = await query<User>(
      'SELECT id, email, display_name, profile_picture, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    res.json({
      data: userResult.rows[0]
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to get user info'
      }
    });
  }
});

export default router;
