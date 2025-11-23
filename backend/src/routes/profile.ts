import express, { Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { query, transaction } from '../db';
import {
  PersonalityProfile,
  MBTIDistribution,
  EnneagramDistribution,
  UpdateMBTIRequest,
  UpdateEnneagramRequest
} from '../types';

const router = express.Router();

/**
 * GET /api/profile
 * Get current user's personality profile with distributions
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Get profile
    const profileResult = await query<PersonalityProfile>(
      'SELECT * FROM personality_profiles WHERE user_id = $1',
      [userId]
    );

    if (profileResult.rows.length === 0) {
      // Create profile if it doesn't exist
      const newProfile = await query<PersonalityProfile>(
        `INSERT INTO personality_profiles (user_id)
         VALUES ($1)
         RETURNING *`,
        [userId]
      );

      return res.json({
        data: {
          profile: newProfile.rows[0],
          mbti: [],
          enneagram: []
        }
      });
    }

    const profile = profileResult.rows[0];

    // Get MBTI distribution
    const mbtiResult = await query<MBTIDistribution>(
      'SELECT type, probability FROM personality_profile_mbti WHERE profile_id = $1 ORDER BY probability DESC',
      [profile.id]
    );

    // Get Enneagram distribution
    const enneagramResult = await query<EnneagramDistribution>(
      'SELECT type, probability FROM personality_profile_enneagram WHERE profile_id = $1 ORDER BY probability DESC',
      [profile.id]
    );

    res.json({
      data: {
        profile: {
          id: profile.id,
          version: profile.version,
          createdAt: profile.created_at,
          updatedAt: profile.updated_at
        },
        mbti: mbtiResult.rows,
        enneagram: enneagramResult.rows
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to get profile'
      }
    });
  }
});

/**
 * PUT /api/profile/mbti
 * Update MBTI distribution with optimistic locking
 */
router.put('/mbti', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { distribution, expectedVersion } = req.body as UpdateMBTIRequest;

    // Validate distribution
    if (!Array.isArray(distribution) || distribution.length === 0) {
      return res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'Distribution must be a non-empty array'
        }
      });
    }

    // Check that probabilities sum to ~1.0 (allow small floating point errors)
    const sum = distribution.reduce((acc, item) => acc + item.probability, 0);
    if (Math.abs(sum - 1.0) > 0.01) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DISTRIBUTION',
          message: `Probabilities must sum to 1.0 (got ${sum})`
        }
      });
    }

    // Update in transaction
    const result = await transaction(async (client) => {
      // Get profile with lock
      const profileResult = await client.query(
        'SELECT * FROM personality_profiles WHERE user_id = $1 FOR UPDATE',
        [userId]
      );

      if (profileResult.rows.length === 0) {
        throw new Error('Profile not found');
      }

      const profile = profileResult.rows[0] as PersonalityProfile;

      // Check version for optimistic locking
      if (expectedVersion !== undefined && profile.version !== expectedVersion) {
        const error: any = new Error('Profile version mismatch');
        error.code = 'CONFLICT';
        throw error;
      }

      // Delete existing MBTI distribution
      await client.query(
        'DELETE FROM personality_profile_mbti WHERE profile_id = $1',
        [profile.id]
      );

      // Insert new distribution
      for (const item of distribution) {
        await client.query(
          `INSERT INTO personality_profile_mbti (profile_id, type, probability)
           VALUES ($1, $2, $3)`,
          [profile.id, item.type, item.probability]
        );
      }

      // Increment version and update timestamp
      const updatedProfile = await client.query(
        `UPDATE personality_profiles
         SET version = version + 1, updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [profile.id]
      );

      return updatedProfile.rows[0] as PersonalityProfile;
    });

    res.json({
      data: {
        version: result.version,
        distribution
      }
    });
  } catch (error: any) {
    console.error('Update MBTI error:', error);

    if (error.code === 'CONFLICT') {
      return res.status(409).json({
        error: {
          code: 'CONFLICT',
          message: 'Profile was updated by another request. Please refresh and try again.'
        }
      });
    }

    res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to update MBTI distribution'
      }
    });
  }
});

/**
 * PUT /api/profile/enneagram
 * Update Enneagram distribution with optimistic locking
 */
router.put('/enneagram', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { distribution, expectedVersion } = req.body as UpdateEnneagramRequest;

    // Validate distribution
    if (!Array.isArray(distribution) || distribution.length === 0) {
      return res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'Distribution must be a non-empty array'
        }
      });
    }

    // Check that probabilities sum to ~1.0
    const sum = distribution.reduce((acc, item) => acc + item.probability, 0);
    if (Math.abs(sum - 1.0) > 0.01) {
      return res.status(400).json({
        error: {
          code: 'INVALID_DISTRIBUTION',
          message: `Probabilities must sum to 1.0 (got ${sum})`
        }
      });
    }

    // Update in transaction
    const result = await transaction(async (client) => {
      // Get profile with lock
      const profileResult = await client.query(
        'SELECT * FROM personality_profiles WHERE user_id = $1 FOR UPDATE',
        [userId]
      );

      if (profileResult.rows.length === 0) {
        throw new Error('Profile not found');
      }

      const profile = profileResult.rows[0] as PersonalityProfile;

      // Check version for optimistic locking
      if (expectedVersion !== undefined && profile.version !== expectedVersion) {
        const error: any = new Error('Profile version mismatch');
        error.code = 'CONFLICT';
        throw error;
      }

      // Delete existing Enneagram distribution
      await client.query(
        'DELETE FROM personality_profile_enneagram WHERE profile_id = $1',
        [profile.id]
      );

      // Insert new distribution
      for (const item of distribution) {
        await client.query(
          `INSERT INTO personality_profile_enneagram (profile_id, type, probability)
           VALUES ($1, $2, $3)`,
          [profile.id, item.type, item.probability]
        );
      }

      // Increment version and update timestamp
      const updatedProfile = await client.query(
        `UPDATE personality_profiles
         SET version = version + 1, updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [profile.id]
      );

      return updatedProfile.rows[0] as PersonalityProfile;
    });

    res.json({
      data: {
        version: result.version,
        distribution
      }
    });
  } catch (error: any) {
    console.error('Update Enneagram error:', error);

    if (error.code === 'CONFLICT') {
      return res.status(409).json({
        error: {
          code: 'CONFLICT',
          message: 'Profile was updated by another request. Please refresh and try again.'
        }
      });
    }

    res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to update Enneagram distribution'
      }
    });
  }
});

export default router;
