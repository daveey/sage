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
  userValidated: boolean;  // true if user clicked thumbs up/down
  skipped: boolean;  // true if user clicked X
}
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

**Database Updates:**
```sql
ALTER TABLE personality_statements
  ADD COLUMN skipped BOOLEAN DEFAULT FALSE;

-- Index for filtering
CREATE INDEX idx_statements_skipped ON personality_statements(user_id, skipped);
```

**Benefits:**
- Faster user validation (3 options vs 5)
- Clear semantics (yes/no vs "somewhat agree")
- Rephrase feature makes profile more accurate
- Skip allows users to defer decisions
- Works great for swipe gestures on mobile

---

### 4. Cache Invalidation Logic
**Question:** When should cached artifacts be invalidated? (#5, #28)

**Decision:** [PENDING]

**Rationale:** [To be filled]

**Implementation Notes:** [To be filled]

---

### 5. Profile Hash Algorithm
**Question:** How should the profile hash be calculated for cache keys? (#28)

**Decision:** [PENDING]

**Rationale:** [To be filled]

**Implementation Notes:** [To be filled]

---

### 6. JWT Token Strategy
**Question:** What should JWT access and refresh token lifespans be? (#30)

**Decision:** [PENDING]

**Rationale:** [To be filled]

**Implementation Notes:** [To be filled]

---

### 7. Input Validation Limits
**Question:** What are the limits for user-provided text? (#31)

**Decision:** [PENDING]

**Rationale:** [To be filled]

**Implementation Notes:** [To be filled]

---

### 8. Personality Distribution Normalization
**Question:** Should personality type distributions be required to sum to 1.0? (#29)

**Decision:** [PENDING]

**Rationale:** [To be filled]

**Implementation Notes:** [To be filled]

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
