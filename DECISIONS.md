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

### 9. Custom Prompts Approach
**Question:** How much freedom should users have in custom prompts? (#10)

**Decision:** [PENDING]

**Rationale:** [To be filled]

**Implementation Notes:** [To be filled]

---

### 10. Statement Generation Strategy
**Question:** When and how should new statements be generated? (#3)

**Decision:** [PENDING]

**Rationale:** [To be filled]

**Implementation Notes:** [To be filled]

---

### 11. LLM Cost Quotas
**Question:** What are the per-user and global LLM usage limits? (#32)

**Decision:** [PENDING]

**Rationale:** [To be filled]

**Implementation Notes:** [To be filled]

---

### 12. Soft Delete Strategy
**Question:** Should deletions be soft (recoverable) or hard (permanent)? (#33)

**Decision:** [PENDING]

**Rationale:** [To be filled]

**Implementation Notes:** [To be filled]

---

### 13. LLM Response Validation
**Question:** How should we validate LLM-generated content before showing to users? (#35)

**Decision:** [PENDING]

**Rationale:** [To be filled]

**Implementation Notes:** [To be filled]

---

### 14. Error Handling Approach
**Question:** How should errors be communicated to users? (#36)

**Decision:** [PENDING]

**Rationale:** [To be filled]

**Implementation Notes:** [To be filled]

---

## Medium Priority Decisions (Decide During Development)

[Questions 15-21 - To be added as needed]

---

## Low Priority Decisions (Can Decide Post-MVP)

[Questions 22-48 - To be deferred]

---

## Summary of Key Decisions

**Technology Stack:**
- Frontend: [TBD]
- Backend: [TBD]
- Database: [TBD]
- LLM Provider: [TBD]

**Cost Budget:**
- Monthly LLM budget: [TBD]
- Expected cost per user: [TBD]

**Security:**
- JWT strategy: [TBD]
- Input validation: [TBD]

**Performance:**
- Caching strategy: [TBD]
- Expected scale: [TBD]
