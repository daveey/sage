import express, { Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { query } from '../db';
import {
  Artifact,
  ArtifactType,
  GenerateArtifactRequest,
  MBTIDistribution,
  EnneagramDistribution,
  PersonalityStatement
} from '../types';
import Anthropic from '@anthropic-ai/sdk';

const router = express.Router();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || ''
});

// Predefined artifact templates
const ARTIFACT_TEMPLATES: Record<ArtifactType, string> = {
  workday_guide: `Create a personalized "Ideal Workday Guide" that helps this person structure their work for maximum productivity and satisfaction. Include:
- Optimal work environment and setup
- Best times for different types of tasks
- Energy management strategies
- Communication preferences with colleagues
- How to handle meetings and interruptions
- Tips for maintaining focus and motivation
Format as a practical, actionable markdown guide with sections.`,

  dating_profile: `Create an authentic, compelling dating profile that reflects this person's personality. Include:
- A unique opening line that captures their essence
- What they value in relationships
- Their communication and conflict resolution style
- Ideal date ideas that match their preferences
- Deal-breakers and green flags
- What makes them a great partner
Format as a dating profile with personality insights woven naturally throughout.`,

  conflict_style: `Create a "Conflict Resolution Guide" for this person. Include:
- How they typically respond to conflict (patterns and triggers)
- Their communication style under stress
- What they need from others during disagreements
- Strategies that work well for them
- Common pitfalls to avoid
- How to create win-win outcomes
Format as a practical guide with examples and actionable advice.`,

  communication_guide: `Create a "Communication Style Guide" for this person. Include:
- How they prefer to communicate (verbal, written, visual)
- Information processing style (big picture vs details)
- Feedback preferences (direct vs gentle)
- Decision-making communication needs
- How to communicate effectively with them
- Tips for them to communicate better with others
Format as a practical markdown guide with clear sections.`,

  decision_framework: `Create a personalized "Decision-Making Framework" for this person. Include:
- Their natural decision-making style
- When they're at their best (and worst) making decisions
- Key factors they should always consider
- Decision-making biases to watch for
- Framework for major vs minor decisions
- How to involve others effectively
Format as a step-by-step framework with examples.`
};

/**
 * GET /api/artifacts
 * List all artifacts for current user
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const result = await query<Artifact>(
      `SELECT * FROM artifacts
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json({
      data: result.rows.map(row => ({
        id: row.id,
        type: row.type,
        title: row.title,
        content: row.content,
        generatedBy: row.generated_by,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString()
      }))
    });
  } catch (error) {
    console.error('Get artifacts error:', error);
    res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to get artifacts'
      }
    });
  }
});

/**
 * GET /api/artifacts/:id
 * Get specific artifact
 */
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const artifactId = req.params.id;

    const result = await query<Artifact>(
      'SELECT * FROM artifacts WHERE id = $1 AND user_id = $2',
      [artifactId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Artifact not found'
        }
      });
    }

    const artifact = result.rows[0];
    res.json({
      data: {
        id: artifact.id,
        type: artifact.type,
        title: artifact.title,
        content: artifact.content,
        generatedBy: artifact.generated_by,
        createdAt: artifact.created_at.toISOString(),
        updatedAt: artifact.updated_at.toISOString()
      }
    });
  } catch (error) {
    console.error('Get artifact error:', error);
    res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to get artifact'
      }
    });
  }
});

/**
 * POST /api/artifacts/generate
 * Generate new artifact using Claude API
 */
router.post('/generate', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { type } = req.body as GenerateArtifactRequest;

    if (!type || !ARTIFACT_TEMPLATES[type]) {
      return res.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: `Invalid artifact type. Must be one of: ${Object.keys(ARTIFACT_TEMPLATES).join(', ')}`
        }
      });
    }

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
      'SELECT type, probability FROM personality_profile_mbti WHERE profile_id = $1 ORDER BY probability DESC',
      [profileId]
    );

    // Get Enneagram distribution
    const enneagramResult = await query<EnneagramDistribution>(
      'SELECT type, probability FROM personality_profile_enneagram WHERE profile_id = $1 ORDER BY probability DESC',
      [profileId]
    );

    // Get validated statements
    const statementsResult = await query<PersonalityStatement>(
      `SELECT statement, credence FROM personality_statements
       WHERE user_id = $1 AND user_validated = TRUE
       ORDER BY updated_at DESC
       LIMIT 30`,
      [userId]
    );

    // Check if we have enough profile data
    if (mbtiResult.rows.length === 0 && enneagramResult.rows.length === 0 && statementsResult.rows.length < 5) {
      return res.status(400).json({
        error: {
          code: 'INSUFFICIENT_PROFILE',
          message: 'Please complete more of your personality profile before generating artifacts'
        }
      });
    }

    // Build personality summary
    const mbtiSummary = mbtiResult.rows.length > 0
      ? mbtiResult.rows.map(r => `${r.type} (${(r.probability * 100).toFixed(0)}%)`).join(', ')
      : 'Not yet determined';

    const enneagramSummary = enneagramResult.rows.length > 0
      ? enneagramResult.rows.map(r => `Type ${r.type} (${(r.probability * 100).toFixed(0)}%)`).join(', ')
      : 'Not yet determined';

    const agreedStatements = statementsResult.rows
      .filter(s => s.credence === 1)
      .map(s => `- ${s.statement}`)
      .join('\n');

    const disagreedStatements = statementsResult.rows
      .filter(s => s.credence === -1)
      .map(s => `- ${s.statement}`)
      .join('\n');

    const prompt = `${ARTIFACT_TEMPLATES[type]}

Personality Profile:
MBTI: ${mbtiSummary}
Enneagram: ${enneagramSummary}

Validated Traits (AGREE):
${agreedStatements || '(none yet)'}

Traits They Don't Identify With (DISAGREE):
${disagreedStatements || '(none yet)'}

Create this artifact as if you're writing it FOR this person, not ABOUT them. Use second person ("you") when giving advice. Be specific, actionable, and authentic. Reference their actual traits naturally throughout.`;

    // Call Claude API
    const startTime = Date.now();
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
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

    const artifactContent = content.text;

    // Generate title based on type
    const titles: Record<ArtifactType, string> = {
      workday_guide: 'Your Ideal Workday Guide',
      dating_profile: 'Your Authentic Dating Profile',
      conflict_style: 'Your Conflict Resolution Guide',
      communication_guide: 'Your Communication Style Guide',
      decision_framework: 'Your Decision-Making Framework'
    };

    // Insert or update artifact (one per type per user)
    const result = await query<Artifact>(
      `INSERT INTO artifacts (user_id, type, title, content, prompt, generated_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, type) DO UPDATE
       SET title = $3, content = $4, prompt = $5, generated_by = $6, updated_at = NOW()
       RETURNING *`,
      [userId, type, titles[type], artifactContent, type, 'claude-sonnet-4.5']
    );

    // Track LLM usage
    const inputTokens = message.usage.input_tokens;
    const outputTokens = message.usage.output_tokens;
    const costUsd = (inputTokens * 0.000003) + (outputTokens * 0.000015); // Claude Sonnet 4 pricing

    await query(
      `INSERT INTO llm_usage (user_id, operation, model, tokens_input, tokens_output, cost_usd)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, 'generate_artifact', 'claude-sonnet-4.5', inputTokens, outputTokens, costUsd]
    );

    const artifact = result.rows[0];
    res.json({
      data: {
        id: artifact.id,
        type: artifact.type,
        title: artifact.title,
        content: artifact.content,
        generatedBy: artifact.generated_by,
        createdAt: artifact.created_at.toISOString()
      }
    });
  } catch (error: any) {
    console.error('Generate artifact error:', error);

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
        message: 'Failed to generate artifact',
        details: error.message
      }
    });
  }
});

/**
 * DELETE /api/artifacts/:id
 * Delete artifact (hard delete in V1)
 */
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const artifactId = req.params.id;

    const result = await query(
      'DELETE FROM artifacts WHERE id = $1 AND user_id = $2 RETURNING id',
      [artifactId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Artifact not found'
        }
      });
    }

    res.json({
      data: { message: 'Artifact deleted successfully' }
    });
  } catch (error) {
    console.error('Delete artifact error:', error);
    res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to delete artifact'
      }
    });
  }
});

export default router;
