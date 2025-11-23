import express, { Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { query } from '../db';
import { PersonalityStatement, UpdateStatementRequest, MBTIDistribution, EnneagramDistribution } from '../types';
import Anthropic from '@anthropic-ai/sdk';

const router = express.Router();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || ''
});

/**
 * GET /api/statements
 * List all statements for current user
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const result = await query<PersonalityStatement>(
      `SELECT * FROM personality_statements
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json({
      data: result.rows.map(row => ({
        id: row.id,
        statement: row.statement,
        credence: row.credence,
        userValidated: row.user_validated,
        source: row.source,
        category: row.category,
        createdAt: row.created_at.toISOString()
      }))
    });
  } catch (error) {
    console.error('Get statements error:', error);
    res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to get statements'
      }
    });
  }
});

/**
 * POST /api/statements
 * Create new statement (user-provided)
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { statement, category } = req.body;

    if (!statement || statement.length < 10 || statement.length > 500) {
      return res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'Statement must be between 10 and 500 characters'
        }
      });
    }

    const result = await query<PersonalityStatement>(
      `INSERT INTO personality_statements (user_id, statement, credence, category, source, user_validated)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, statement, 0, category || null, 'user_provided', false]
    );

    res.json({
      data: {
        id: result.rows[0].id,
        statement: result.rows[0].statement,
        credence: result.rows[0].credence,
        userValidated: result.rows[0].user_validated,
        source: result.rows[0].source,
        category: result.rows[0].category,
        createdAt: result.rows[0].created_at.toISOString()
      }
    });
  } catch (error) {
    console.error('Create statement error:', error);
    res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to create statement'
      }
    });
  }
});

/**
 * PUT /api/statements/:id
 * Update statement credence (validation)
 */
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const statementId = req.params.id;
    const { credence } = req.body as UpdateStatementRequest;

    if (credence !== -1 && credence !== 0 && credence !== 1) {
      return res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'Credence must be -1, 0, or 1'
        }
      });
    }

    const result = await query<PersonalityStatement>(
      `UPDATE personality_statements
       SET credence = $1, user_validated = TRUE, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [credence, statementId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Statement not found'
        }
      });
    }

    res.json({
      data: {
        id: result.rows[0].id,
        statement: result.rows[0].statement,
        credence: result.rows[0].credence,
        userValidated: result.rows[0].user_validated,
        source: result.rows[0].source,
        category: result.rows[0].category,
        createdAt: result.rows[0].created_at.toISOString()
      }
    });
  } catch (error) {
    console.error('Update statement error:', error);
    res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to update statement'
      }
    });
  }
});

/**
 * DELETE /api/statements/:id
 * Delete statement (hard delete in V1)
 */
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const statementId = req.params.id;

    const result = await query(
      'DELETE FROM personality_statements WHERE id = $1 AND user_id = $2 RETURNING id',
      [statementId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Statement not found'
        }
      });
    }

    res.json({
      data: { message: 'Statement deleted successfully' }
    });
  } catch (error) {
    console.error('Delete statement error:', error);
    res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to delete statement'
      }
    });
  }
});

/**
 * POST /api/statements/generate
 * Generate 10 new statements using Claude API based on personality profile
 */
router.post('/generate', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Get user's personality profile
    const profileResult = await query(
      'SELECT id FROM personality_profiles WHERE user_id = $1',
      [userId]
    );

    if (profileResult.rows.length === 0) {
      return res.status(400).json({
        error: {
          code: 'NO_PROFILE',
          message: 'Please complete your personality profile first'
        }
      });
    }

    const profileId = profileResult.rows[0].id;

    // Get MBTI distribution
    const mbtiResult = await query<MBTIDistribution>(
      'SELECT type, probability FROM personality_profile_mbti WHERE profile_id = $1 ORDER BY probability DESC LIMIT 3',
      [profileId]
    );

    // Get Enneagram distribution
    const enneagramResult = await query<EnneagramDistribution>(
      'SELECT type, probability FROM personality_profile_enneagram WHERE profile_id = $1 ORDER BY probability DESC LIMIT 3',
      [profileId]
    );

    // Get existing validated statements for context
    const existingStatements = await query<PersonalityStatement>(
      `SELECT statement FROM personality_statements
       WHERE user_id = $1 AND user_validated = TRUE
       LIMIT 20`,
      [userId]
    );

    // Build prompt for Claude
    const mbtiSummary = mbtiResult.rows.length > 0
      ? mbtiResult.rows.map(r => `${r.type} (${(r.probability * 100).toFixed(0)}%)`).join(', ')
      : 'Not yet determined';

    const enneagramSummary = enneagramResult.rows.length > 0
      ? enneagramResult.rows.map(r => `Type ${r.type} (${(r.probability * 100).toFixed(0)}%)`).join(', ')
      : 'Not yet determined';

    const existingContext = existingStatements.rows.length > 0
      ? `\n\nUser has already validated these statements:\n${existingStatements.rows.map(s => `- ${s.statement}`).join('\n')}`
      : '';

    const prompt = `You are helping build a personality profile. Generate 10 specific, concrete statements about this person's preferences, behaviors, and traits.

Personality Profile:
- MBTI: ${mbtiSummary}
- Enneagram: ${enneagramSummary}${existingContext}

Generate 10 statements that:
1. Are specific and concrete (not vague)
2. Are between 10-100 words each
3. Cover different aspects: work style, communication, decision-making, social preferences, stress response, values
4. Are phrased as "I" statements (first person)
5. Are diverse - don't repeat similar ideas
6. Avoid existing statements above

Return ONLY a JSON array of strings, no other text:
["statement 1", "statement 2", ...]`;

    // Call Claude API
    const startTime = Date.now();
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const duration = Date.now() - startTime;
    console.log(`✅ Claude API call completed in ${duration}ms`);

    // Parse response
    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    let statements: string[];
    try {
      statements = JSON.parse(content.text);
    } catch (e) {
      // Try to extract JSON from the response
      const jsonMatch = content.text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        statements = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse statements from Claude response');
      }
    }

    // Insert statements into database
    const insertedStatements: any[] = [];
    for (const statement of statements) {
      const result = await query<PersonalityStatement>(
        `INSERT INTO personality_statements (user_id, statement, credence, source, user_validated)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [userId, statement, 0, 'llm_inferred', false]
      );
      insertedStatements.push({
        id: result.rows[0].id,
        statement: result.rows[0].statement,
        credence: result.rows[0].credence,
        userValidated: result.rows[0].user_validated,
        source: result.rows[0].source,
        category: result.rows[0].category,
        createdAt: result.rows[0].created_at.toISOString()
      });
    }

    // Track LLM usage
    const inputTokens = message.usage.input_tokens;
    const outputTokens = message.usage.output_tokens;
    const costUsd = (inputTokens * 0.000003) + (outputTokens * 0.000015); // Claude Sonnet 4 pricing

    await query(
      `INSERT INTO llm_usage (user_id, operation, model, tokens_input, tokens_output, cost_usd)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, 'generate_statements', 'claude-sonnet-4.5', inputTokens, outputTokens, costUsd]
    );

    res.json({
      data: insertedStatements
    });
  } catch (error: any) {
    console.error('Generate statements error:', error);

    if (error.status === 429) {
      return res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'API rate limit exceeded. Please try again later.',
          retryAfter: 60
        }
      });
    }

    res.status(500).json({
      error: {
        code: 'LLM_API_FAILURE',
        message: 'Failed to generate statements'
      }
    });
  }
});

export default router;
