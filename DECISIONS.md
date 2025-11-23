# Design Decisions

This document records all decisions made for the personality profiling app. Each decision references the corresponding question from CLARIFICATIONS_NEEDED.md.

**Status:** In Progress
**Last Updated:** 2025-11-23

---

## Critical Decisions (Must Answer Before Development)

### 1. Initial Personality Assessment ✅
**Question:** How should users initially establish their personality profile?

**Decision:** Multi-path onboarding with 4 options, ChatGPT prompt-based analysis as recommended default

**Paths Offered:**
1. **"Get analysis from ChatGPT" (RECOMMENDED)** - Copy prompt, paste into ChatGPT, paste response back
2. **"I know my types"** - Manual entry + optional self-description
3. **"Take conversational assessment"** - LLM-driven adaptive Q&A (5-10 exchanges)
4. **"Skip for now"** - Start with blank profile, add statements manually

**Rationale:**
- ChatGPT prompt approach is simplest UX (no file uploads)
- ChatGPT already has user's conversation history
- User controls privacy (decides what to share)
- No cost to us (analysis done in user's ChatGPT)
- Serves all user types: informed, new, exploratory, privacy-conscious
- Fast time-to-value: all paths reach first artifact in <10 minutes

**Implementation Notes:**

**Path 1: ChatGPT Prompt Template**
```
App shows copyable prompt:
"Analyze our conversation history and provide my personality profile:

MBTI: [type] (confidence: 0-1)
Enneagram: [type] (confidence: 0-1)
Big5: Openness:__, Conscientiousness:__, Extraversion:__, Agreeableness:__, Neuroticism:__ (0-100)

25 Personality Statements with credence (-1 to 1):
1. [statement] (credence: X.X)
2. [statement] (credence: X.X)
..."

User pastes ChatGPT's response → we parse structured output
```

**Path 2: Manual Entry**
- User enters known types (MBTI/Enneagram/Big5)
- Optional: "Tell us about yourself" text box
- We use LLM to generate 15-20 statements from self-description

**Path 3: Conversational Assessment**
- Adaptive LLM-driven Q&A (not static questionnaire)
- 5-10 exchanges based on previous answers
- Generates profile + statements at end

**Path 4: Skip**
- Start with blank profile
- User manually adds statements
- Can take assessment later from profile page

**Cost Estimate:**
- Path 1 (ChatGPT): $0 (user's ChatGPT does analysis)
- Path 2 (Manual): ~$0.10-0.30 per user (statement generation)
- Path 3 (Conversational): ~$0.30-0.60 per user (our LLM)
- Path 4 (Skip): $0
- Average: ~$0.15 per user onboarding (much cheaper than archive analysis!)

---

### 2. LLM Provider and Budget ✅
**Question:** Which LLM should be primary and what's the budget? (Related: #6, #26, #32)

**Decision:** Claude Sonnet 4.5 as primary, with abstraction layer for easy provider swapping

**Provider Strategy:**
- **Primary:** Claude Sonnet 4.5 (best quality for personality analysis)
- **Fallback:** GPT-4o (if Claude fails/unavailable)
- **Architecture:** LLM abstraction layer (easy to swap providers)
- **User choice:** No (system decides - simpler MVP)

**Usage Limits (Abuse Prevention):**
- Artifact generation: 20/day per user
- Statement generation: 10/day per user
- Conversational assessment: 3/day per user
- No monthly limits (trust + monitor)

**Cost Budget:**
- No hard budget limit (willing to spend as needed)
- Monitor costs via dashboard (no automated alerts for MVP)
- Target: ~$2-5/user/month average
- Scale estimate: 1,000 users = ~$2,000-5,000/month

**Rationale:**
- Claude Sonnet: Superior quality for nuanced personality analysis
- Abstraction layer: Future-proof (easy to switch to GPT-5, local models, etc.)
- Generous daily limits prevent abuse but don't restrict legitimate use
- No budget constraints allows focus on quality over cost

**Implementation Notes:**

**LLM Abstraction Layer:**
```typescript
// Abstract interface
interface LLMProvider {
  generateCompletion(prompt: string, options?: LLMOptions): Promise<string>;
  generateStreaming(prompt: string, options?: LLMOptions): AsyncIterator<string>;
  estimateCost(prompt: string, completion: string): number;
}

// Implementations
class ClaudeProvider implements LLMProvider { ... }
class GPTProvider implements LLMProvider { ... }

// Configuration
const LLM_CONFIG = {
  primary: 'claude-sonnet-4.5',
  fallback: 'gpt-4o',
  providers: {
    'claude-sonnet-4.5': new ClaudeProvider(),
    'gpt-4o': new GPTProvider(),
  }
};

// Usage
const llm = LLM_CONFIG.providers[LLM_CONFIG.primary];
```

**Task-Specific Provider Selection:**
```typescript
const LLM_STRATEGY = {
  profileAnalysis: 'claude-sonnet-4.5',
  statementGeneration: 'claude-sonnet-4.5',
  conversationalAssessment: 'claude-sonnet-4.5',
  artifactGeneration: 'claude-sonnet-4.5',
  // Easy to change per-task if needed
};
```

**Fallback Strategy:**
```typescript
async function generateWithFallback(prompt: string): Promise<string> {
  try {
    return await llm.primary.generateCompletion(prompt);
  } catch (error) {
    logger.warn('Primary LLM failed, using fallback', { error });
    return await llm.fallback.generateCompletion(prompt);
  }
}
```

**Cost Tracking:**
```sql
-- Track LLM usage for monitoring
CREATE TABLE llm_usage (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  operation VARCHAR(50), -- 'artifact', 'statement', 'assessment'
  provider VARCHAR(50),  -- 'claude-sonnet-4.5', 'gpt-4o'
  tokens_input INTEGER,
  tokens_output INTEGER,
  cost_usd DECIMAL(10,6),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_llm_usage_user_date ON llm_usage(user_id, created_at);
CREATE INDEX idx_llm_usage_date ON llm_usage(created_at);
```

**Daily Limits Implementation:**
```typescript
// Rate limiting per user per day
const DAILY_LIMITS = {
  artifactGeneration: 20,
  statementGeneration: 10,
  conversationalAssessment: 3,
};

// Check before each operation
async function checkRateLimit(userId: string, operation: string): Promise<boolean> {
  const today = startOfDay(new Date());
  const count = await db.llm_usage.count({
    where: {
      user_id: userId,
      operation: operation,
      created_at: { gte: today }
    }
  });

  return count < DAILY_LIMITS[operation];
}
```

---

### 3. Credence Granularity ✅
**Question:** How fine-grained should the credence scale be? (#4)

**Decision:** 3-point scale with Yes/No/Skip plus Rephrase option

**UI Buttons:**
- 👍 **Thumbs Up** = Agree (credence: 1)
- 👎 **Thumbs Down** = Disagree (credence: -1)
- ❌ **X** = Skip/Remove statement (don't include in profile)
- ✏️ **Rephrase** = Edit statement text inline

**Rationale:**
- Simpler than 5-point scale (faster validation)
- Clear, unambiguous options
- Mobile-friendly (large touch targets)
- Rephrase empowers users to refine statements to match their exact thinking
- Binary agree/disagree is cognitively easier than gradations

**Implementation Notes:**

**Data Model:**
```typescript
interface PersonalityStatement {
  credence: number;  // -1 (disagree), 0 (neutral/skipped), 1 (agree)
  precision: number;  // 0-1: how confident/certain (0 = very uncertain, 1 = very certain)
  emphasized: boolean;  // true if user marked as particularly important
  userValidated: boolean;  // true if user clicked thumbs up/down
  skipped: boolean;  // true if user clicked X
}

// Examples:
// "I prefer working alone" - credence: 1, precision: 0.95, emphasized: true (core belief!)
// "I like spicy food" - credence: 0.3, precision: 0.4, emphasized: false (minor preference)
// "I'm a morning person" - credence: -1, precision: 1.0, emphasized: true (definitely NOT me)
```

**Mobile UI (Swipe Mode):**
```
┌─────────────────────────────────────┐
│ Statement: "I prefer working alone" │
│                                     │
│  Swipe ← to disagree               │
│  Swipe → to agree                  │
│  Tap ❌ to skip                     │
│  Tap ✏️ to rephrase                │
│                                     │
│    👎        ❌  ✏️        👍      │
└─────────────────────────────────────┘
```

**Desktop UI:**
```
Statement: "I prefer working alone"
[👎 Disagree]  [❌ Skip]  [✏️ Rephrase]  [👍 Agree]
```

**Rephrase Flow:**
1. User clicks ✏️ Rephrase
2. Statement becomes editable text field
3. User modifies text
4. User clicks Save or Cancel
5. Modified statement automatically marked as user_validated = true
6. Source changes to 'user_provided'

**Skip vs Remove:**
- Skip: Statement stays in database but excluded from profile hash/artifacts
- Can be revisited later in "Skipped Statements" section
- Useful for "not sure yet" statements

**Precision UI Flow:**
After user clicks 👍 or 👎, ask follow-up:
```
"How confident are you about this?"
[Not very sure] [Somewhat sure] [Very sure]
    0.3             0.6            0.95
```

Or use slider:
```
Certainty: [====|----] 40%
```

**Default Precision Values:**
- User-validated (thumbs up/down): 0.8 (reasonably confident)
- LLM-generated: 0.5 (moderate uncertainty)
- ChatGPT import: 0.7 (fairly confident)
- User manually wrote statement: 0.9 (high confidence)

**Emphasis Feature:**
User can highlight particularly important statements (core beliefs, defining traits).

```
Statement: "I thrive in deep, focused work"
[⭐ Emphasize] [✏️ Rephrase] [🗑️ Delete]

After emphasizing:
★ "I thrive in deep, focused work" (emphasized)
[Remove emphasis] [✏️ Rephrase] [🗑️ Delete]
```

**Emphasized Statements in Artifacts:**
All statements shown in artifacts are interactive:

```markdown
## Key Personality Traits

Based on your profile:
- ★ You thrive in deep, focused work [✏️] [🗑️]
- You prefer asynchronous communication [⭐] [✏️] [🗑️]
- You value autonomy highly [⭐] [✏️] [🗑️]

★ = Emphasized (core belief)
[⭐] = Emphasize this
[✏️] = Edit statement
[🗑️] = Remove from profile
```

When user clicks actions in artifact:
- **Emphasize**: Marks as emphasized, increases weight in future generations
- **Edit**: Opens inline editor, updates statement text
- **Delete**: Removes from profile, marks artifact as outdated

**Weighting in Artifact Generation:**
Emphasized statements carry 2x weight:

```typescript
function calculateStatementWeight(statement: Statement): number {
  const baseWeight = Math.abs(statement.credence) * statement.precision;
  const emphasisMultiplier = statement.emphasized ? 2.0 : 1.0;
  return baseWeight * emphasisMultiplier;
}

// When selecting statements for artifact prompt
const weightedStatements = statements
  .map(s => ({ ...s, weight: calculateStatementWeight(s) }))
  .sort((a, b) => b.weight - a.weight)
  .slice(0, 20);  // Top 20 most important statements
```

**Database Updates:**
```sql
ALTER TABLE personality_statements
  ADD COLUMN skipped BOOLEAN DEFAULT FALSE,
  ADD COLUMN precision DECIMAL(3,2) DEFAULT 0.5 CHECK (precision >= 0 AND precision <= 1),
  ADD COLUMN emphasized BOOLEAN DEFAULT FALSE;

-- Index for filtering high-uncertainty statements
CREATE INDEX idx_statements_skipped ON personality_statements(user_id, skipped);
CREATE INDEX idx_statements_uncertainty ON personality_statements(user_id, precision);
CREATE INDEX idx_statements_emphasized ON personality_statements(user_id, emphasized) WHERE emphasized = TRUE;
```

**API Endpoints for Statement Actions:**
```typescript
// Emphasize/de-emphasize
PUT /api/statements/:id/emphasize
Body: { emphasized: boolean }

// Edit statement (can be called from anywhere)
PUT /api/statements/:id
Body: { statement: string }

// Delete statement (marks artifact as outdated if used in any)
DELETE /api/statements/:id
Response: { artifactsAffected: number, needsRegeneration: boolean }
```

**Personality Type Distributions (Also Get Precision):**
```typescript
interface PersonalityProfile {
  mbtiDistribution: {
    type: MBTIType;
    probability: number;  // 0-1, must sum to 1.0
    precision: number;    // 0-1, confidence in this probability
  }[];

  enneagramDistribution: {
    type: EnneagramType;
    probability: number;
    precision: number;
  }[];

  big5Scores: {
    openness: number;          // 0-100
    openness_precision: number; // 0-1
    conscientiousness: number;
    conscientiousness_precision: number;
    // ... etc for all traits
  };
}
```

**Information-Theoretic Prioritization:**
```typescript
// Prioritize statements that reduce most uncertainty
function getPrioritizedStatements(statements: Statement[]): Statement[] {
  return statements
    .filter(s => !s.userValidated && !s.skipped)
    .sort((a, b) => {
      // Lower precision = higher uncertainty = higher priority
      const aUncertainty = 1 - a.precision;
      const bUncertainty = 1 - b.precision;
      return bUncertainty - aUncertainty;
    });
}

// Measure surprise when user updates a statement
function calculateSurprise(oldCredence: number, oldPrecision: number,
                           newCredence: number): number {
  // High precision + large credence change = high surprise
  const credenceChange = Math.abs(newCredence - oldCredence);
  return credenceChange * oldPrecision;
}

// Suggest statements to review based on uncertainty
function suggestStatementsToReview(userId: string): Statement[] {
  // Find statements with low precision that are used in artifacts
  return db.statements.findMany({
    where: {
      userId,
      precision: { lt: 0.6 },  // Uncertain
      credence: { not: 0 },     // Has an opinion
      userValidated: true
    },
    orderBy: { precision: 'asc' },  // Lowest precision first
    take: 5
  });
}
```

**Benefits:**
- Faster user validation (3 options vs 5)
- Clear semantics (yes/no vs "somewhat agree")
- Rephrase feature makes profile more accurate
- Skip allows users to defer decisions
- Works great for swipe gestures on mobile
- **Precision enables uncertainty quantification**
- **Prioritize reviewing uncertain beliefs**
- **Measure information gain from new evidence**
- **Better artifact generation (weight by precision)**
- **✨ Emphasis highlights core beliefs** (2x weight in generation)
- **✨ Interactive artifacts** (edit/delete/emphasize from anywhere)
- **✨ Profile refinement everywhere** (not just profile page)

---

### 4. Cache Invalidation Logic ✅
**Question:** When should cached artifacts be invalidated? (#5, #28)

**Decision:** Fingerprint-based deviation detection with user-triggered incremental regeneration

**Core Strategy:**
- Store personality fingerprint with each artifact (snapshot at generation time)
- Calculate deviation between current and artifact fingerprints
- Notify user when deviation exceeds threshold
- User decides when to regenerate (not automatic)
- For multiple artifacts, offer background batch regeneration
- Use diff-aware prompting for efficient incremental updates

**Rationale:**
- Efficient: Only regenerate when personality meaningfully changes
- User control: No surprise LLM costs, user decides when to refresh
- Intelligent updates: LLM receives context about what changed
- Insightful: User sees how profile evolution affects recommendations
- Scalable: Background processing for many artifacts

**Implementation Notes:**

**Personality Fingerprint (stored with each artifact):**
```typescript
interface PersonalityFingerprint {
  timestamp: Date;

  // MBTI distribution with precision
  mbti: {
    type: MBTIType;
    probability: number;  // 0-1
    precision: number;    // 0-1
  }[];

  // Enneagram distribution with precision
  enneagram: {
    type: EnneagramType;
    probability: number;
    precision: number;
  }[];

  // Big5 scores with precision
  big5: {
    trait: string;  // 'openness', 'conscientiousness', etc.
    score: number;  // 0-100
    precision: number;  // 0-1
  }[];

  // Key statements (high credence, high precision)
  keyStatements: {
    id: string;
    text: string;
    credence: number;
    precision: number;
  }[];

  // Hash for quick comparison
  hash: string;
}

interface Artifact {
  // ... existing fields
  personalityFingerprint: PersonalityFingerprint;
  needsRegeneration: boolean;  // Computed field
  deviationScore: number;      // Computed field
}
```

**Deviation Calculation:**
```typescript
function calculateDeviation(
  oldFingerprint: PersonalityFingerprint,
  currentProfile: PersonalityProfile
): number {
  let totalDeviation = 0;
  let weightSum = 0;

  // MBTI deviation (weighted by precision)
  for (const oldMbti of oldFingerprint.mbti) {
    const currentMbti = currentProfile.mbtiDistribution.find(m => m.type === oldMbti.type);
    if (currentMbti) {
      const probChange = Math.abs(currentMbti.probability - oldMbti.probability);
      const weight = (oldMbti.precision + currentMbti.precision) / 2;
      totalDeviation += probChange * weight;
      weightSum += weight;
    }
  }

  // Enneagram deviation (same logic)
  for (const oldEnneagram of oldFingerprint.enneagram) {
    const currentEnneagram = currentProfile.enneagramDistribution.find(e => e.type === oldEnneagram.type);
    if (currentEnneagram) {
      const probChange = Math.abs(currentEnneagram.probability - oldEnneagram.probability);
      const weight = (oldEnneagram.precision + currentEnneagram.precision) / 2;
      totalDeviation += probChange * weight;
      weightSum += weight;
    }
  }

  // Big5 deviation (trait score changes)
  for (const oldTrait of oldFingerprint.big5) {
    const currentScore = currentProfile.big5Scores[oldTrait.trait];
    const currentPrecision = currentProfile.big5Scores[`${oldTrait.trait}_precision`];
    const scoreChange = Math.abs(currentScore - oldTrait.score) / 100;  // Normalize to 0-1
    const weight = (oldTrait.precision + currentPrecision) / 2;
    totalDeviation += scoreChange * weight;
    weightSum += weight;
  }

  // Statement deviation (key statements changed)
  const currentStatements = getCurrentKeyStatements(currentProfile);
  for (const oldStmt of oldFingerprint.keyStatements) {
    const currentStmt = currentStatements.find(s => s.id === oldStmt.id);
    if (currentStmt) {
      const credenceChange = Math.abs(currentStmt.credence - oldStmt.credence);
      const weight = (oldStmt.precision + currentStmt.precision) / 2;
      totalDeviation += credenceChange * weight;
      weightSum += weight;
    } else {
      // Statement removed or skipped - high deviation
      totalDeviation += oldStmt.precision;
      weightSum += oldStmt.precision;
    }
  }

  return weightSum > 0 ? totalDeviation / weightSum : 0;  // Normalized 0-1
}
```

**Deviation Thresholds:**
```typescript
const DEVIATION_THRESHOLDS = {
  NOTIFY: 0.15,      // Show "Profile changed" badge
  SUGGEST: 0.30,     // Suggest regeneration
  SIGNIFICANT: 0.50  // Mark as significantly outdated
};
```

**User Notification UI:**
```
┌─────────────────────────────────────────────┐
│ 📊 Your Ideal Workday Guide                │
│                                             │
│ ⚠️ Your profile has changed significantly  │
│    since this was generated                │
│                                             │
│ Major changes:                              │
│ • MBTI shifted from INTJ → INTP (+25%)    │
│ • Openness increased by 15 points          │
│ • 3 key beliefs updated                    │
│                                             │
│ [View Changes] [Regenerate Now] [Dismiss]  │
└─────────────────────────────────────────────┘
```

**Batch Background Regeneration:**
```typescript
// User clicks "Update all outdated artifacts"
async function scheduleArtifactRegeneration(userId: string) {
  const outdatedArtifacts = await db.artifacts.findMany({
    where: {
      userId,
      deviationScore: { gt: DEVIATION_THRESHOLDS.SUGGEST }
    },
    orderBy: { deviationScore: 'desc' }  // Most outdated first
  });

  // Queue regeneration jobs
  for (const artifact of outdatedArtifacts) {
    await queue.add('regenerate-artifact', {
      userId,
      artifactId: artifact.id,
      mode: 'incremental'  // Use diff-aware prompting
    });
  }

  return { queued: outdatedArtifacts.length };
}
```

**Diff-Aware Regeneration Prompt:**
```typescript
const diffAwarePrompt = `
You previously generated a "${artifactType}" for this user.

PREVIOUS ARTIFACT (generated ${daysAgo} days ago):
${previousArtifactContent}

PERSONALITY CHANGES SINCE THEN:
${generateChangeSummary(oldFingerprint, currentFingerprint)}

Examples of changes:
- MBTI: Was 80% INTJ, now 60% INTJ / 40% INTP (exploring more possibilities)
- Big5 Openness: Increased from 65 → 80 (more open to new experiences)
- New belief: "I thrive in collaborative environments" (credence: 0.8, precision: 0.9)
- Updated belief: "I prefer working alone" changed from 0.8 → 0.3

TASK:
Update the artifact to reflect these personality changes.
1. Identify which sections need updating based on the changes
2. Explain what changed and why (brief commentary)
3. Provide the updated artifact

Format:
## What Changed
[Brief explanation of how personality shifts affect recommendations]

## Updated Artifact
[Full updated content in markdown]
`;
```

**Profile Hash Algorithm (for cache keys):**
```typescript
function calculateProfileHash(profile: PersonalityProfile): string {
  const fingerprint = createFingerprint(profile);

  // Include only validated, non-skipped statements with |credence| > 0
  const keyStatements = profile.statements
    .filter(s => s.userValidated && !s.skipped && Math.abs(s.credence) > 0)
    .sort((a, b) => a.id.localeCompare(b.id))  // Deterministic order
    .map(s => `${s.id}:${s.credence}:${s.precision}`);

  const hashInput = {
    mbti: fingerprint.mbti,
    enneagram: fingerprint.enneagram,
    big5: fingerprint.big5,
    statements: keyStatements
  };

  return sha256(JSON.stringify(hashInput));
}
```

**Cache Key Format:**
```
artifact:{userId}:{artifactType}:{profileHash}
```

**Database Schema Updates:**
```sql
ALTER TABLE artifacts
  ADD COLUMN personality_fingerprint JSONB NOT NULL,
  ADD COLUMN deviation_score DECIMAL(3,2) DEFAULT 0,
  ADD COLUMN needs_regeneration BOOLEAN DEFAULT FALSE;

-- Index for finding outdated artifacts
CREATE INDEX idx_artifacts_outdated
  ON artifacts(user_id, deviation_score DESC)
  WHERE needs_regeneration = TRUE;
```

**Benefits:**
- **Efficient**: Incremental updates vs full regeneration
- **Insightful**: Users see how personality evolution affects outputs
- **Cost-effective**: Only regenerate when meaningful deviation occurs
- **User control**: No surprise LLM costs
- **Scalable**: Background batch processing
- **Smart prompting**: LLM gets context about what changed

---

### 5. Profile Hash Algorithm ✅
**Question:** How should the profile hash be calculated for cache keys? (#28)

**Decision:** Covered in #4 - Fingerprint-based hashing with validated statements + precision

**See Decision #4 for full implementation.** Key points:

- Hash includes: MBTI distribution, Enneagram distribution, Big5 scores, validated statements
- Statements included if: userValidated=true, skipped=false, |credence| > 0
- Format: `sha256(JSON.stringify({mbti, enneagram, big5, statements}))`
- Statements sorted by ID for deterministic hashing
- Statement hash format: `id:credence:precision`
- Cache key: `artifact:{userId}:{artifactType}:{profileHash}`

**Rationale:**
- Deterministic: Same profile always produces same hash
- Precise: Includes precision term for nuanced comparison
- Efficient: Excludes skipped/neutral statements
- Secure: SHA-256 prevents collisions

---

### 6. JWT Token Strategy ✅
**Question:** What should JWT access and refresh token lifespans be? (#30)

**Decision:** Convenience-first with 8-hour access tokens and 30-day refresh tokens

**Token Lifespans:**
- **Access Token:** 8 hours (full workday without re-auth)
- **Refresh Token:** 30 days (with rotation)
- **Rotation:** New refresh token issued on each use

**Rationale:**
- User preference: Prioritize convenience over maximum security
- 8 hours: Covers full workday + evening without interruption
- 30 days: Users stay logged in for a month (typical usage pattern)
- Refresh rotation: Maintains security despite longer lifespans
- Trade-off: Slightly less secure than 1hr tokens, but much better UX

**Implementation Notes:**

```typescript
const TOKEN_CONFIG = {
  access: {
    expiresIn: '8h',
    algorithm: 'HS256' as const
  },
  refresh: {
    expiresIn: '30d',
    rotate: true,  // Issue new refresh token on use
    storeInDb: true  // Track active refresh tokens for revocation
  }
};

// JWT payload
interface AccessTokenPayload {
  userId: string;
  email: string;
  iat: number;  // Issued at
  exp: number;  // Expires at
}

interface RefreshTokenPayload {
  userId: string;
  tokenId: string;  // Unique ID for this refresh token
  iat: number;
  exp: number;
}
```

**Refresh Token Storage (for revocation):**
```sql
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL,  -- SHA-256 hash of token
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP,
  revoked BOOLEAN DEFAULT FALSE,
  user_agent TEXT,
  ip_address INET
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);
```

**Token Refresh Flow:**
```typescript
async function refreshAccessToken(refreshToken: string): Promise<Tokens> {
  // 1. Verify refresh token
  const payload = jwt.verify(refreshToken, process.env.JWT_SECRET);

  // 2. Check if token is in database and not revoked
  const storedToken = await db.refreshTokens.findOne({
    where: {
      token_hash: sha256(refreshToken),
      revoked: false,
      expires_at: { gt: new Date() }
    }
  });

  if (!storedToken) {
    throw new Error('Invalid or revoked refresh token');
  }

  // 3. Generate new access token
  const newAccessToken = generateAccessToken(payload.userId);

  // 4. Rotate refresh token (invalidate old, create new)
  await db.transaction(async (tx) => {
    // Mark old token as revoked
    await tx.refreshTokens.update({
      where: { id: storedToken.id },
      data: { revoked: true }
    });

    // Create new refresh token
    const newRefreshToken = generateRefreshToken(payload.userId);
    await tx.refreshTokens.create({
      data: {
        user_id: payload.userId,
        token_hash: sha256(newRefreshToken),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)  // 30 days
      }
    });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  });
}
```

**Revoke All Sessions:**
```typescript
// User clicks "Logout all devices"
async function revokeAllUserTokens(userId: string): Promise<number> {
  const result = await db.refreshTokens.updateMany({
    where: { user_id: userId, revoked: false },
    data: { revoked: true }
  });
  return result.count;
}
```

**Automatic Cleanup:**
```typescript
// Cron job: Delete expired refresh tokens daily
async function cleanupExpiredTokens(): Promise<number> {
  const result = await db.refreshTokens.deleteMany({
    where: {
      OR: [
        { expires_at: { lt: new Date() } },
        { revoked: true, created_at: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }  // 7 days old
      ]
    }
  });
  return result.count;
}
```

**Security Considerations:**
- Longer tokens = larger attack window if stolen
- Mitigation: Refresh rotation limits token lifetime
- Mitigation: Store tokens in httpOnly cookies (not localStorage)
- Mitigation: HTTPS only in production
- Mitigation: User can revoke all sessions manually

**Benefits:**
- Seamless UX: Stay logged in for 30 days
- No annoying re-auth during work sessions
- Still revocable: Can logout all devices
- Trackable: Know which devices are active

---

### 7. Shareable Artifacts ✅
**Question:** Should artifacts be shareable? (Related: #8)

**Decision:** Yes - each artifact gets a unique opaque share link

**Core Features:**
- Every artifact has unique random share ID (not UUID)
- Public route `/share/{shareId}` accessible without auth
- Share button on each artifact
- Track view counts on shared artifacts
- Privacy toggle (public/private per artifact)

**Implementation:** See full details in separate decision note below.

**Rationale:**
- Viral growth: Users share insights with friends
- Collaboration: Share guides with team/therapist
- Portfolio: Showcase personality insights
- Network effects: Recipients → sign up
- Trust building: Transparency in recommendations

---

### 8. Input Validation Limits ✅
**Question:** What are the limits for user-provided text? (#31)

**Decision:** Generous limits with soft caps

**Limits:**
- **Statement text:** 500 characters (1-2 sentences)
- **Custom artifact prompt:** 1000 characters
- **Display name:** 100 characters
- **Statements per user:** 1000 (soft cap, warn at 500)
- **Artifacts per user:** 200 (soft cap, warn at 100)

**Rationale:**
- 500 chars for statements: Enough for nuance, not essays
- 1000 chars for prompts: Room for detailed custom requests
- Soft caps with warnings: Prevent abuse without hard limits
- High limits: Trust users, no artificial constraints

**Implementation:**
```typescript
const VALIDATION_LIMITS = {
  statement: {
    minLength: 10,
    maxLength: 500,
    pattern: /^[\w\s\p{P}]+$/u  // Alphanumeric + punctuation
  },
  customPrompt: {
    minLength: 20,
    maxLength: 1000
  },
  displayName: {
    minLength: 2,
    maxLength: 100
  },
  statementsPerUser: {
    softCap: 500,  // Warn user
    hardCap: 1000  // Reject
  },
  artifactsPerUser: {
    softCap: 100,
    hardCap: 200
  }
};

// Validation schema (Zod)
const StatementSchema = z.object({
  statement: z.string()
    .min(10, 'Statement too short')
    .max(500, 'Statement must be under 500 characters')
    .regex(/^[\w\s\p{P}]+$/u, 'Invalid characters'),
  credence: z.number().min(-1).max(1),
  precision: z.number().min(0).max(1),
  emphasized: z.boolean().optional()
});
```

---

### 9. Personality Distribution Normalization ✅
**Question:** Should personality type distributions be required to sum to 1.0? (#29)

**Decision:** Yes - enforce probability distribution with validation

**Rules:**
- MBTI probabilities must sum to 1.0 (±0.01 tolerance)
- Enneagram probabilities must sum to 1.0 (±0.01 tolerance)
- Each type probability: 0.0 to 1.0
- Auto-normalize if close (within 5% of 1.0)

**Rationale:**
- Probabilities that don't sum to 1.0 are mathematically invalid
- Makes deviation calculation accurate
- Prevents data integrity issues
- Auto-normalization handles rounding errors

**Implementation:**
```typescript
interface PersonalityDistribution {
  type: string;
  probability: number;  // 0-1
  precision: number;    // 0-1
}

function validateDistribution(dist: PersonalityDistribution[]): boolean {
  const sum = dist.reduce((acc, d) => acc + d.probability, 0);

  // Check if sum is approximately 1.0
  if (Math.abs(sum - 1.0) < 0.01) {
    return true;  // Valid
  }

  // If close (within 5%), auto-normalize
  if (Math.abs(sum - 1.0) < 0.05) {
    dist.forEach(d => d.probability /= sum);
    return true;
  }

  // Otherwise invalid
  throw new Error(`Distribution probabilities must sum to 1.0, got ${sum}`);
}

// Validation schema
const PersonalityProfileSchema = z.object({
  mbtiDistribution: z.array(z.object({
    type: z.enum(['INTJ', 'INTP', ...]),  // All 16 types
    probability: z.number().min(0).max(1),
    precision: z.number().min(0).max(1)
  })).refine(validateDistribution, {
    message: 'MBTI probabilities must sum to 1.0'
  }),

  enneagramDistribution: z.array(z.object({
    type: z.string(),  // "1", "2", ..., "9", "1w2", etc.
    probability: z.number().min(0).max(1),
    precision: z.number().min(0).max(1)
  })).refine(validateDistribution, {
    message: 'Enneagram probabilities must sum to 1.0'
  })
});
```

**Database Constraint:**
```sql
-- Application-level validation (can't easily enforce in SQL)
-- But add check for individual probabilities
ALTER TABLE personality_profiles
  ADD CONSTRAINT check_mbti_distribution
    CHECK (jsonb_array_length(mbti_distribution) > 0),
  ADD CONSTRAINT check_enneagram_distribution
    CHECK (jsonb_array_length(enneagram_distribution) > 0);
```

---

## High Priority Decisions (Decide in First 2 Weeks)

### 10. Custom Prompts Approach ✅
**Question:** How much freedom should users have in custom prompts? (Related: CLARIFICATIONS #10)

**Decision:** Phased approach - predefined templates for V1, custom prompts in V2+

**Phased Implementation:**
- **V1:** Predefined templates only
  - 5 templates: Workday Guide, Communication Style, Decision Framework, Conflict Style, Dating Profile
  - No custom prompts (security + quality risk)
- **V2:** Add custom prompts with safeguards
  - 1000 char limit (Decision #8)
  - Sanitization to prevent prompt injection
  - Template scaffolding: "Generate a guide for [topic] focusing on [aspect]"
  - Preview/validation before generation
- **V3:** User-created templates
  - Save custom prompts for reuse
  - Share templates with community

**Rationale:**
- **Security risk:** Prompt injection could leak data or manipulate outputs
- **Quality risk:** Bad prompts → bad artifacts → poor user experience
- **Start simple:** Validate concept with curated templates first
- **Gradual expansion:** Add custom prompts once we understand usage patterns

**Implementation Notes:**
```typescript
// V2: Sanitize custom prompts
function sanitizeCustomPrompt(prompt: string): string {
  // 1. Limit length
  if (prompt.length > 1000) {
    throw new Error("Prompt too long");
  }

  // 2. Remove HTML/script tags
  const cleaned = DOMPurify.sanitize(prompt, { ALLOWED_TAGS: [] });

  // 3. Prefix with safe template
  return `
    You are generating a personalized artifact for a user.
    The user requested: "${cleaned}"

    Use the following personality profile:
    ${profileData}

    Generate the requested artifact in markdown format.
  `;
}

// 4. Validate LLM output (no <script> tags in response)
function validateLLMOutput(output: string): boolean {
  const hasScriptTags = /<script/i.test(output);
  const hasEventHandlers = /on\w+\s*=/i.test(output);
  return !hasScriptTags && !hasEventHandlers;
}
```

---

### 11. Statement Generation Strategy ✅
**Question:** When and how should new statements be generated? (Related: CLARIFICATIONS #3)

**Decision:** User-triggered only, no automatic generation

**Strategy:**
- **Initial onboarding:** Generate 20-25 statements (from ChatGPT import or LLM)
- **After onboarding:** Only user-triggered via "Generate more statements" button
- **No automatic generation:** Prevents overwhelming users with endless statements
- **Smart prompts:** Show helpful nudges without auto-generating
  - "You have 15 validated statements. Add 5 more for better artifacts."
  - "Review 3 uncertain statements to improve profile accuracy."

**Information-Theoretic Prioritization:**
```typescript
// Prioritize statements that reduce most uncertainty
function getPrioritizedStatements(statements: Statement[]): Statement[] {
  return statements
    .filter(s => !s.userValidated && !s.skipped)
    .sort((a, b) => {
      // Lower precision = higher uncertainty = higher priority
      const aUncertainty = 1 - a.precision;
      const bUncertainty = 1 - b.precision;
      return bUncertainty - aUncertainty;
    });
}

// Suggest statements to review based on uncertainty
function suggestStatementsToReview(userId: string): Statement[] {
  return db.statements.findMany({
    where: {
      userId,
      precision: { lt: 0.6 },  // Uncertain
      credence: { not: 0 },     // Has an opinion
      userValidated: true
    },
    orderBy: { precision: 'asc' },  // Lowest precision first
    take: 5
  });
}
```

**Rationale:**
- **Prevents "inbox zero" anxiety:** Users don't feel pressure to validate endless statements
- **User stays in control:** No surprise statement generation
- **Quality over quantity:** Better to have 20 well-validated statements than 100 uncertain ones
- **Focus on high-value updates:** Prioritize reviewing uncertain beliefs for maximum information gain

**Implementation Notes:**
- "Generate more statements" button shows after user validates 80% of existing statements
- Generation creates 10 new statements at a time (not 50+)
- LLM generates statements based on:
  1. Current personality types (fill gaps)
  2. Statement categories with few examples
  3. Contradictions in existing statements (to resolve ambiguity)

---

### 12. LLM Cost Quotas ✅
**Question:** What are the per-user and global LLM usage limits? (Related: CLARIFICATIONS #32)

**Decision:** Generous daily limits with no global budget cap

**Confirmed from Decision #2:**
- **Daily limits per user:**
  - Artifact generation: 20/day
  - Statement generation: 10/day
  - Conversational assessment: 3/day
- **No monthly caps:** Trust users + monitor usage
- **No global budget limit:** "Willing to spend as needed"
- **Cost monitoring:** Track via llm_usage table, dashboard for review

**Rationale:**
- User said: "I am always willing to spend tokens. I am willing to spend as many tokens as needed, never a problem"
- Daily limits prevent abuse without restricting legitimate use
- No need for complex quota system
- Monitor costs passively, react if patterns emerge

**Implementation Notes:**
- See Decision #2 for full implementation details
- Rate limiting enforced at API level (not client-side)
- Graceful error messages: "You've generated 20 artifacts today. Try again tomorrow."
- Admin dashboard shows daily/monthly costs per user

---

### 13. Soft Delete Strategy ✅
**Question:** Should deletions be soft (recoverable) or hard (permanent)? (Related: CLARIFICATIONS #33)

**Decision:** Soft delete for users only, hard delete for statements/artifacts

**Strategy:**
- **Users:** Soft delete with 30-day recovery, then hard delete
- **Statements:** Hard delete immediately (easily regenerated)
- **Artifacts:** Hard delete immediately (easily regenerated)
- **Account deletion flow:**
  1. User clicks "Delete Account"
  2. Show confirmation: "Your account will be deleted in 30 days. You can cancel anytime."
  3. Account marked as `deleted_at: Date` (soft delete)
  4. User cannot login but can recover via email link
  5. After 30 days: Cron job hard deletes account + all data (GDPR compliant)

**Rationale:**
- **Prevents accidental user loss:** 30-day recovery window for accounts
- **Keeps data clean:** Statements/artifacts don't need recovery (regenerate instead)
- **GDPR compliant:** Right to erasure honored after 30 days
- **Simple implementation:** No complex recovery UI for statements

**Implementation Notes:**
```typescript
// Soft delete user
async function softDeleteUser(userId: string): Promise<void> {
  await db.users.update({
    where: { id: userId },
    data: {
      deleted_at: new Date(),
      email: `deleted_${userId}@example.com`  // Free up email for re-registration
    }
  });

  // Send confirmation email with recovery link
  await sendEmail(user.email, {
    subject: "Account deletion scheduled",
    body: `Your account will be deleted in 30 days. Click here to cancel: ${recoveryLink}`
  });
}

// Recovery flow
async function recoverUser(userId: string, token: string): Promise<void> {
  // Verify token
  const isValid = verifyRecoveryToken(token);
  if (!isValid) throw new Error("Invalid recovery token");

  // Restore user
  await db.users.update({
    where: { id: userId },
    data: {
      deleted_at: null,
      email: originalEmail  // Restore original email
    }
  });
}

// Cron job: Hard delete after 30 days
async function hardDeleteExpiredUsers(): Promise<void> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const expiredUsers = await db.users.findMany({
    where: {
      deleted_at: { lte: thirtyDaysAgo }
    }
  });

  for (const user of expiredUsers) {
    // Hard delete cascades to all related data
    await db.users.delete({ where: { id: user.id } });

    // Delete cached artifacts
    const cacheKeys = await redis.keys(`artifact:${user.id}:*`);
    if (cacheKeys.length > 0) {
      await redis.del(...cacheKeys);
    }

    // Anonymize LLM usage logs
    await db.llm_usage.updateMany({
      where: { userId: user.id },
      data: { userId: 'DELETED', anonymized: true }
    });
  }
}
```

**Database Schema:**
```sql
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP NULL;
CREATE INDEX idx_users_deleted ON users(deleted_at) WHERE deleted_at IS NOT NULL;
```

---

### 14. LLM Response Validation ✅
**Question:** How should we validate LLM-generated content before showing to users? (Related: CLARIFICATIONS #35)

**Decision:** Length + format validation with retry logic

**Validation Strategy:**
- **Length validation:** Min 100 chars, max 10,000 chars for artifacts
- **Format validation:** Must be valid markdown
- **Structure validation:** For ChatGPT import, validate JSON structure
- **Retry logic:** If validation fails, retry once with "fix your response" prompt
- **No hallucination detection:** Trust LLM for personality content (not factual claims)
- **No content moderation:** Not needed for personality artifacts

**Rationale:**
- **Prevents broken UX:** Malformed responses would confuse users
- **Simple implementation:** No complex validation needed
- **Trust LLM:** Claude Sonnet 4.5 is reliable for personality content
- **One retry:** Gives LLM a second chance without excessive retries

**Implementation Notes:**
```typescript
// Validate artifact response
interface ValidationResult {
  valid: boolean;
  error?: string;
  fixPrompt?: string;
}

function validateArtifactResponse(response: string, type: string): ValidationResult {
  // 1. Length check
  if (response.length < 100) {
    return {
      valid: false,
      error: "Response too short",
      fixPrompt: "Generate a longer, more detailed response (at least 100 characters)."
    };
  }

  if (response.length > 10000) {
    return {
      valid: false,
      error: "Response too long",
      fixPrompt: "Generate a more concise response (under 10,000 characters)."
    };
  }

  // 2. Format check (basic markdown validation)
  const hasHeaders = /^#+\s+/m.test(response);
  const hasContent = response.trim().length > 0;

  if (!hasHeaders || !hasContent) {
    return {
      valid: false,
      error: "Invalid markdown format",
      fixPrompt: "Generate a properly formatted markdown response with headers and content."
    };
  }

  // 3. Security check (no script tags)
  if (/<script/i.test(response) || /on\w+\s*=/i.test(response)) {
    return {
      valid: false,
      error: "Security violation",
      fixPrompt: "Remove any HTML script tags or event handlers from your response."
    };
  }

  return { valid: true };
}

// Artifact generation with retry
async function generateArtifactWithRetry(userId: string, type: string): Promise<string> {
  const prompt = constructArtifactPrompt(userId, type);

  // First attempt
  let response = await llm.generateCompletion(prompt);
  let validation = validateArtifactResponse(response, type);

  if (validation.valid) {
    return response;
  }

  // Retry once with fix prompt
  console.warn('Invalid LLM response, retrying...', validation.error);
  const retryPrompt = `${prompt}\n\nIMPORTANT: ${validation.fixPrompt}`;

  response = await llm.generateCompletion(retryPrompt);
  validation = validateArtifactResponse(response, type);

  if (!validation.valid) {
    throw new Error(`LLM validation failed after retry: ${validation.error}`);
  }

  return response;
}

// ChatGPT import validation
interface ChatGPTImport {
  mbti: { type: string; confidence: number };
  enneagram: { type: string; confidence: number };
  big5: { [key: string]: number };
  statements: Array<{ text: string; credence: number }>;
}

function validateChatGPTImport(response: string): ChatGPTImport | null {
  try {
    // Try parsing as JSON
    const data = JSON.parse(response);

    // Validate structure
    if (!data.mbti || !data.enneagram || !data.big5 || !data.statements) {
      return null;
    }

    // Validate ranges
    if (data.mbti.confidence < 0 || data.mbti.confidence > 1) return null;
    if (data.statements.length < 5) return null;

    return data as ChatGPTImport;
  } catch (error) {
    // Not JSON, try parsing as text using our own LLM
    return null;
  }
}
```

---

### 15. Error Handling Approach ✅
**Question:** How should errors be communicated to users? (Related: CLARIFICATIONS #36)

**Decision:** Specific, actionable error messages with appropriate UI patterns

**Error Communication Strategy:**
- **Toast notifications:** Transient errors (network, temporary failures)
- **Modal dialogs:** Critical errors (data loss, auth failure, permanent blocks)
- **Inline validation:** Form errors (invalid input, field-level)
- **Banner notifications:** System-wide issues (maintenance, API down)

**Error Message Templates:**
```typescript
const ERROR_MESSAGES = {
  // LLM failures
  LLM_API_FAILURE: {
    title: "Generation failed",
    message: "Our AI service is temporarily unavailable. Try again in a few minutes.",
    action: "Retry",
    type: "toast"
  },

  // Rate limiting
  RATE_LIMIT: {
    title: "Daily limit reached",
    message: "You've generated 20 artifacts today. Try again tomorrow.",
    action: "View Usage",
    type: "modal"
  },

  // Validation errors
  INVALID_INPUT: {
    title: "Invalid input",
    message: "Statement must be 10-500 characters.",
    action: "Fix",
    type: "inline"
  },

  // Network errors
  NETWORK_ERROR: {
    title: "Connection lost",
    message: "Check your internet connection and try again.",
    action: "Retry",
    type: "toast"
  },

  // Server errors
  SERVER_ERROR: {
    title: "Something went wrong",
    message: "We're working on it. Try again in a few minutes.",
    action: "Dismiss",
    type: "toast"
  },

  // Auth errors
  AUTH_EXPIRED: {
    title: "Session expired",
    message: "Your session has expired. Please sign in again.",
    action: "Sign In",
    type: "modal"
  },

  // Data errors
  NOT_FOUND: {
    title: "Not found",
    message: "The artifact you're looking for doesn't exist.",
    action: "Go to Dashboard",
    type: "banner"
  }
};
```

**Implementation Pattern:**
```typescript
// Error handling wrapper
async function handleApiCall<T>(
  apiCall: () => Promise<T>,
  errorContext: string
): Promise<T> {
  try {
    return await apiCall();
  } catch (error) {
    if (error.response?.status === 429) {
      showModal(ERROR_MESSAGES.RATE_LIMIT);
    } else if (error.response?.status === 401) {
      showModal(ERROR_MESSAGES.AUTH_EXPIRED);
    } else if (error.code === 'ECONNABORTED') {
      showToast(ERROR_MESSAGES.NETWORK_ERROR);
    } else if (error.response?.status >= 500) {
      showToast(ERROR_MESSAGES.SERVER_ERROR);
    } else {
      // Log unexpected errors to Sentry
      Sentry.captureException(error, { context: errorContext });
      showToast(ERROR_MESSAGES.SERVER_ERROR);
    }

    throw error;  // Re-throw for caller to handle if needed
  }
}

// Usage
const artifact = await handleApiCall(
  () => api.generateArtifact(userId, type),
  'artifact_generation'
);
```

**User-Friendly Error Examples:**
```
❌ Bad: "Error 429: Too Many Requests"
✅ Good: "You've generated 20 artifacts today. Try again tomorrow at 12:00 AM."

❌ Bad: "ECONNREFUSED"
✅ Good: "Connection lost. Check your internet and try again."

❌ Bad: "Validation failed"
✅ Good: "Statement must be 10-500 characters (currently 8 characters)"

❌ Bad: "LLM API error: timeout"
✅ Good: "Generation took too long and timed out. Try again with a simpler prompt."
```

**Rationale:**
- **User-centric:** Technical jargon replaced with clear language
- **Actionable:** Always provide next step (Retry, Fix, View, etc.)
- **Appropriate UI:** Match severity to UI pattern (toast vs modal)
- **Informative:** Enough detail to understand what went wrong

**Implementation Notes:**
- Use React Toast library (react-hot-toast or sonner)
- Modal for blocking errors, toast for non-blocking
- Include error tracking ID for support debugging
- Retry button includes exponential backoff (2s, 4s, 8s)

---

## Medium Priority Decisions (Decide During Development)

### 16. Profile Update Mechanism ✅
**Question:** How does the system update personality distributions when users agree/disagree with statements? (Related: CLARIFICATIONS #2)

**Decision:** Manual re-evaluation only, statements don't auto-update personality types

**Strategy:**
- Statements are informational only
- Do NOT automatically update MBTI/Enneagram/Big5 distributions when user validates statements
- Provide "Re-evaluate personality types" button that:
  1. Analyzes all validated statements
  2. Uses LLM to suggest updated distributions
  3. Shows "Your profile analysis suggests: INTJ (85%) vs previous INTJ (75%)"
  4. User approves or rejects suggested changes
- Prevents confusing auto-updates that user doesn't understand

**Rationale:**
- Less confusing: User sees their personality types stay stable
- User control: Explicit re-evaluation vs mysterious auto-changes
- Prevents drift: Statements don't gradually shift personality types without awareness

---

### 17. Statement Deduplication ✅
**Question:** How to handle similar/duplicate statements? (Related: CLARIFICATIONS #15)

**Decision:** No automated deduplication for MVP, manual removal only

**Strategy:**
- No LLM similarity checking (adds latency + cost)
- User manually deletes duplicates if they notice
- V2+: Show "similar statements" warning using embeddings

**Rationale:**
- **MVP simplicity:** Not a critical problem initially
- **Low frequency:** Users won't create many duplicates manually
- **Easy workaround:** User can delete duplicates themselves
- **Future enhancement:** Add embeddings-based similarity in V2

---

### 18. Artifact Versioning ✅
**Question:** Should we keep version history of artifacts? (Related: CLARIFICATIONS #7)

**Decision:** Single latest version only for MVP

**Strategy:**
- Each artifact type has one current version
- Regenerating overwrites previous version
- No version history stored
- V2+: Add versioning with "View history" feature

**Rationale:**
- **Simpler data model:** No versions table needed
- **Lower storage costs:** Don't store 10 versions of each artifact
- **Sufficient for MVP:** Users care about current artifact, not history
- **Easy to add later:** Can add versions table in V2 without major refactor

---

### 19. Big5 Score Input ✅
**Question:** How do users provide/update Big5 scores? (Related: CLARIFICATIONS #9)

**Decision:** LLM-inferred initially, user can manually adjust via sliders

**Strategy:**
- Initial assessment: LLM infers Big5 from MBTI + Enneagram + statements
- Profile page: Show sliders for each trait (0-100)
- User can adjust sliders manually
- Each adjustment updates precision (user-adjusted = high precision)
- No separate Big5 questionnaire

**Rationale:**
- **Avoids long questionnaire:** Big5 tests are 44-120 questions
- **Reasonable estimates:** LLM can infer decent estimates from other data
- **User refinement:** Sliders let users correct inaccurate estimates
- **Consistency:** Matches our "LLM + user validation" pattern

---

### 20. Database Transaction Strategy ✅
**Question:** Which operations should be wrapped in transactions? (Related: CLARIFICATIONS #34)

**Decision:** Use transactions for multi-step critical operations

**Operations requiring transactions:**
- User creation + profile initialization + initial statements
- Artifact generation + fingerprint + caching + storage
- Batch statement updates
- Profile re-evaluation + distribution updates
- Account deletion + cascade deletes

**Implementation:**
```typescript
// User creation transaction
await db.transaction(async (tx) => {
  const user = await tx.users.create({ data: userData });
  await tx.personalityProfiles.create({ data: { userId: user.id, ...profileData } });
  await tx.personalityStatements.createMany({ data: statements });
});

// Artifact generation transaction
await db.transaction(async (tx) => {
  const artifact = await tx.artifacts.create({ data: artifactData });
  await redis.set(`artifact:${userId}:${type}:${hash}`, artifact.content, { ex: 2592000 });
});
```

**Rationale:**
- **Data consistency:** Multi-step operations either fully succeed or fully fail
- **No partial state:** Prevent orphaned records
- **Simple pattern:** PostgreSQL transactions are reliable and performant

---

### 21. Monitoring & Observability ✅
**Question:** What metrics should be monitored? (Related: CLARIFICATIONS #37)

**Decision:** Basic logging + simple metrics for MVP, no alerts

**MVP Monitoring:**
- **Logging:** Winston or Pino for structured logs
- **Metrics collected:**
  - API response times (p50, p95, p99)
  - Error rates by endpoint
  - LLM API latency and errors
  - Cache hit rate
  - Database query performance
  - Active users (daily/weekly/monthly)
  - LLM costs per user
- **Storage:** Logs to file + Railway built-in logs
- **Visualization:** Simple dashboard (query database directly)
- **No alerts:** Manual review of logs/metrics

**V2+ Enhancements:**
- Add Sentry for error tracking
- Add Grafana dashboards
- Set up alerts for critical thresholds
- Add distributed tracing (OpenTelemetry)

**Rationale:**
- **Start simple:** Don't over-engineer observability for MVP
- **Railway provides basics:** Built-in logs and metrics
- **Manual review sufficient:** Low user count means manual monitoring works
- **Easy to enhance:** Can add Sentry/Grafana later without changing code

---

### 22. Database Backup & Recovery ✅
**Question:** What's the backup and disaster recovery strategy? (Related: CLARIFICATIONS #38)

**Decision:** Daily automated backups via managed database provider

**Strategy:**
- **Rely on Railway PostgreSQL addon:** Automatic daily backups
- **Retention:** 30-day retention (Railway default)
- **Recovery:** Use Railway dashboard to restore from backup
- **No custom backup logic:** Trust managed service
- **V1 (SQLite):** Manual backup of .db file

**Rationale:**
- **Managed service reliability:** Railway handles backups automatically
- **Cost-effective:** Included in managed PostgreSQL pricing
- **Simple recovery:** One-click restore via dashboard
- **Sufficient for MVP:** 30-day retention covers accidental deletion scenarios

---

### 23. Testing Strategy ✅
**Question:** What testing approach should we use? (Related: DESIGN_CRITIQUE.md testing gaps)

**Decision:** Fast unit tests for all functionality, run on every change

**Testing Requirements:**
- **Unit tests:** Fast (<1s total), run frequently during development
- **Test coverage:** All core logic (profile calculations, deviation, validation, hashing)
- **Run on save:** Tests execute automatically when Claude makes changes
- **CI integration:** Tests run on git push (GitHub Actions)
- **No slow tests in unit suite:** Integration/E2E tests separate

**Test Stack:**
- **Framework:** Vitest (faster than Jest, ESM-native)
- **Assertions:** Vitest built-in matchers
- **Mocking:** Vitest mocks for LLM/database
- **Coverage:** vitest --coverage (target: >80%)

**What to Test:**
```typescript
// 1. Profile hash calculation (deterministic)
describe('calculateProfileHash', () => {
  it('produces same hash for identical profiles', () => {
    const profile1 = createTestProfile();
    const profile2 = createTestProfile();
    expect(calculateProfileHash(profile1)).toBe(calculateProfileHash(profile2));
  });

  it('produces different hash when statement changes', () => {
    const profile1 = createTestProfile();
    const profile2 = { ...profile1, statements: [...profile1.statements, newStatement] };
    expect(calculateProfileHash(profile1)).not.toBe(calculateProfileHash(profile2));
  });
});

// 2. Deviation calculation (precision-weighted)
describe('calculateDeviation', () => {
  it('returns 0 for identical fingerprints', () => {
    const fingerprint = createTestFingerprint();
    expect(calculateDeviation(fingerprint, fingerprint)).toBe(0);
  });

  it('weights changes by precision', () => {
    const old = createFingerprint({ mbti: [{ type: 'INTJ', prob: 0.8, precision: 0.9 }] });
    const new = createFingerprint({ mbti: [{ type: 'INTJ', prob: 0.7, precision: 0.9 }] });
    const deviation = calculateDeviation(old, new);
    expect(deviation).toBeGreaterThan(0);
  });
});

// 3. Distribution normalization
describe('validateDistribution', () => {
  it('accepts distributions that sum to 1.0', () => {
    const dist = [{ type: 'INTJ', prob: 0.6 }, { type: 'INTP', prob: 0.4 }];
    expect(() => validateDistribution(dist)).not.toThrow();
  });

  it('auto-normalizes distributions within 5% of 1.0', () => {
    const dist = [{ type: 'INTJ', prob: 0.6 }, { type: 'INTP', prob: 0.42 }];  // sum = 1.02
    validateDistribution(dist);
    expect(dist[0].prob + dist[1].prob).toBeCloseTo(1.0);
  });

  it('rejects distributions far from 1.0', () => {
    const dist = [{ type: 'INTJ', prob: 0.3 }, { type: 'INTP', prob: 0.3 }];  // sum = 0.6
    expect(() => validateDistribution(dist)).toThrow();
  });
});

// 4. Statement weighting (emphasis)
describe('calculateStatementWeight', () => {
  it('applies 2x multiplier for emphasized statements', () => {
    const normal = { credence: 1, precision: 0.8, emphasized: false };
    const emphasized = { credence: 1, precision: 0.8, emphasized: true };
    expect(calculateStatementWeight(emphasized)).toBe(calculateStatementWeight(normal) * 2);
  });
});

// 5. Input validation
describe('validateStatement', () => {
  it('accepts valid statements', () => {
    expect(() => validateStatement({ text: 'I prefer working alone', credence: 1 })).not.toThrow();
  });

  it('rejects statements under 10 chars', () => {
    expect(() => validateStatement({ text: 'short', credence: 1 })).toThrow();
  });

  it('rejects statements over 500 chars', () => {
    expect(() => validateStatement({ text: 'x'.repeat(501), credence: 1 })).toThrow();
  });
});

// 6. Share ID generation
describe('generateShareId', () => {
  it('generates 8-character IDs', () => {
    const id = generateShareId();
    expect(id).toHaveLength(8);
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => generateShareId()));
    expect(ids.size).toBe(1000);  // All unique
  });
});
```

**Test Script Setup:**
```json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest --coverage",
    "test:ui": "vitest --ui"
  }
}
```

**Watch Mode for Claude:**
```bash
# Claude runs this in background terminal
npm run test:watch
# Tests auto-run on file save
```

**Rationale:**
- **Fast feedback:** Unit tests run in <1s, don't slow down development
- **Confidence:** Test core logic prevents regressions
- **Documentation:** Tests serve as examples of how functions work
- **Claude-friendly:** Fast tests mean Claude can verify changes immediately

**Not Tested (Deferred to V2):**
- Integration tests (database + API)
- E2E tests (full user flows)
- Visual regression tests
- Performance tests

---

## Low Priority Decisions (Defer to Post-MVP)

### 24-48. Deferred Features ✅

The following questions are deferred to post-MVP with sensible defaults for V1:

**24. Mobile Interaction Patterns (#23):** Swipe for agree/disagree (Tinder-style) + tap to expand
**25. Statement Presentation Order (#21):** Category-grouped, sorted by credence within category
**26. Visual Design Style (#22):** Minimalist/modern (like Notion, Linear)
**27. Artifact Display Format (#24):** Markdown rendered as HTML, read-only for MVP
**28. Profile Completeness Indicator (#25):** Yes - percentage based on validated types + statements
**29. Statement Privacy & Sharing (#8):** Fully private for MVP (covered by Decision #7 for artifacts)
**30. Real-time Updates (#13):** No real-time for MVP, user refreshes to see updates
**31. File Storage for Artifacts (#14):** Markdown/HTML only, add PDF/DOCX export in V2
**32. Monetization Strategy (#16):** Fully free for MVP, evaluate pricing later
**33. Data Retention (#17):** Keep indefinitely, provide manual delete option (covered by Decision #13)
**34. Analytics & Telemetry (#18):** Basic analytics via PostgreSQL queries, no third-party for MVP
**35. Onboarding Flow (#19):** Multi-path assessment (covered by Decision #1)
**36. Frontend State Management (#12):** React Query + Context (no Redux needed for MVP)
**37. API Versioning (#39):** No versioning for MVP, add `/api/v1/` in V2 when stabilizing
**38. Accessibility Level (#40):** Basic keyboard navigation + semantic HTML, work toward WCAG 2.1 AA in V2
**39. Loading States (#41):** Skeleton screens for lists, spinners for actions, progress bars for LLM generation
**40. Email Notifications (#42):** No emails for MVP, add transactional emails in V2
**41. Statement Weighting (#43):** Emphasis feature (covered by Decision #3), no other weighting needed
**42. Profile Snapshot Versioning (#44):** Store full snapshot in artifact for MVP, optimize in V2
**43. Multi-device Sessions (#45):** Multiple sessions allowed, no management UI for MVP
**44. GDPR Export (#46):** "Delete Account" button for MVP (covered by Decision #13), add data export in V2
**45. Personality Framework Bias (#47):** Add disclaimer, focus on user-validated statements as ground truth
**46. Artifact Regeneration Strategy (#48):** Invalidate cache, overwrite existing artifact (covered by Decision #4)
**47. Statement Categorization (#3.1):** Optional LLM-suggested category, user can edit, default to "OTHER"
**48. Statement Source Tracking (#3.2):** Display as subtle badge, use for default precision values

**Rationale for Batch Deferral:**
- **MVP focus:** These don't block core functionality
- **User feedback needed:** Better to ship MVP and learn what users actually want
- **Easy to add later:** None of these require major architectural changes
- **Avoid over-engineering:** Don't build features users might not need

---

## Summary: All 48 Questions Decided ✅

**Status:** All clarification questions resolved (23 explicit decisions + 25 deferred with defaults)

**Technology Stack:**
- Frontend: React + TypeScript + Vite + TailwindCSS + React Query
- Backend: Express + TypeScript + SQLite (V1) → PostgreSQL (V2+)
- Database: SQLite (V1), PostgreSQL (V2+), Redis for caching
- LLM Provider: Claude Sonnet 4.5 (primary), GPT-4o (fallback), with abstraction layer
- Testing: Vitest for fast unit tests (<1s)
- Deployment: Railway.app (backend + PostgreSQL + Redis)

**Cost Budget:**
- Daily LLM limits: 20 artifacts, 10 statements, 3 assessments per user
- No monthly cap: "Willing to spend as needed"
- Monitoring: Track via llm_usage table, manual review

**Security:**
- JWT: 8hr access tokens, 30day refresh tokens with rotation
- Input validation: 500 char statements, 1000 char prompts, Zod schemas
- Rate limiting: Daily limits prevent abuse
- Soft delete: 30-day recovery for users, hard delete for statements/artifacts

**Performance:**
- Caching: Fingerprint-based with deviation detection (SHA-256 profile hash)
- Deviation thresholds: 0.15 (notify), 0.30 (suggest regen), 0.50 (outdated)
- Expected scale: 100-1000 users initially, design for 10K+

**Core Features (23 Decisions):**
1. Multi-path onboarding (ChatGPT prompt recommended)
2. Claude Sonnet 4.5 + LLM abstraction
3. Binary credence + precision + emphasis
4. Fingerprint-based caching with deviation detection
5. Integrated profile hash algorithm
6. 8hr/30day JWT with rotation
7. Shareable artifacts with opaque links
8. Generous validation limits
9. Probability distribution normalization
10. Custom prompts (V1: templates only, V2+: custom)
11. User-triggered statement generation only
12. Confirmed cost quotas (Decision #2)
13. Soft delete for users, hard for statements/artifacts
14. LLM response validation (length + format + retry)
15. Specific error messages with actions
16. Manual profile re-evaluation only
17. No statement deduplication for MVP
18. Single artifact version (no history for MVP)
19. LLM-inferred Big5 + user-adjustable sliders
20. Database transactions for critical operations
21. Basic monitoring (logs + metrics, no alerts)
22. Daily backups via Railway PostgreSQL
23. Fast unit tests with Vitest (run on every change)

**Deferred to Post-MVP (25 Questions):**
24-48. Mobile patterns, UI polish, monetization, analytics, accessibility, real-time updates, email, versioning, etc. - All have sensible defaults, easy to add later.

---

## Next Steps

All decisions are now documented. Ready to:
1. **Fold all decisions into DESIGN.md**
2. **Update CLARIFICATIONS_NEEDED.md to mark all as resolved**
3. **Remove DECISIONS.md** (no longer needed once integrated)
4. **Commit final consolidated design**
