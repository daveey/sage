# Personality Profiling App - Design Document

## 1. Overview

A web-based application that builds and maintains detailed personality profiles for users, then generates personalized artifacts (guides, templates, recommendations) based on those profiles.

### Core Value Proposition
Users receive highly personalized content by maintaining a living personality profile that combines established psychological frameworks (MBTI, Enneagram, Big5) with dynamic, user-validated statements about their preferences, behaviors, and traits.

### Design Decisions Status
This design incorporates **48 decisions** across critical, high-priority, medium-priority, and deferred categories:

**Critical Decisions (1-9):**
1. ✅ Multi-path onboarding (ChatGPT prompt recommended)
2. ✅ Claude Sonnet 4.5 with LLM abstraction layer
3. ✅ Binary credence + precision + emphasis features
4. ✅ Fingerprint-based caching with deviation detection
5. ✅ Integrated profile hash algorithm
6. ✅ 8hr access / 30day refresh JWT tokens
7. ✅ Shareable artifacts with opaque links
8. ✅ Generous validation limits (500 char statements, 1000 artifacts max)
9. ✅ Probability distribution normalization

**High-Priority Decisions (10-15):**
10. ✅ Custom prompts (V1: templates, V2+: custom with sanitization)
11. ✅ User-triggered statement generation only
12. ✅ LLM cost quotas (20/10/3 daily limits, no global cap)
13. ✅ Soft delete for users (30-day recovery), hard delete for artifacts
14. ✅ LLM response validation (length + format + retry)
15. ✅ Specific error messages with appropriate UI patterns

**Medium-Priority Decisions (16-23):**
16. ✅ Manual profile re-evaluation only (no auto-updates)
17. ✅ No statement deduplication for MVP
18. ✅ Single artifact version (no history for MVP)
19. ✅ LLM-inferred Big5 + user-adjustable sliders
20. ✅ Database transactions for critical operations
21. ✅ Basic monitoring (logs + metrics, no alerts for MVP)
22. ✅ Daily backups via Railway PostgreSQL
23. ✅ Vitest unit tests (<1s), run on every change

**Deferred Decisions (24-48):**
Mobile patterns, UI polish, monetization, analytics, accessibility, real-time updates, email notifications, API versioning, and other enhancements deferred to post-MVP with sensible defaults.

**See MILESTONES.md for phased development plan (V1: single-user, V2: multi-user, V3: advanced, V4: production).**

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────┐
│   Client    │
│ (React SPA) │
└──────┬──────┘
       │
       ↓
┌─────────────────────────────────────┐
│      Application Server             │
│  ┌──────────────────────────────┐  │
│  │   API Layer (Express/FastAPI)│  │
│  ├──────────────────────────────┤  │
│  │   Auth Service (Google OAuth)│  │
│  ├──────────────────────────────┤  │
│  │   Profile Service            │  │
│  ├──────────────────────────────┤  │
│  │   Artifact Generation Service│  │
│  ├──────────────────────────────┤  │
│  │   LLM Integration Layer      │  │
│  └──────────────────────────────┘  │
└──────────────┬──────────────────────┘
               │
               ↓
┌──────────────────────────────────────┐
│         Data Layer                   │
│  ┌────────────┐  ┌────────────────┐ │
│  │ PostgreSQL │  │ Redis (Cache)  │ │
│  │  Database  │  │                │ │
│  └────────────┘  └────────────────┘ │
└──────────────────────────────────────┘
               │
               ↓
┌──────────────────────────────────────┐
│      External Services               │
│  ┌────────────┐  ┌────────────────┐ │
│  │Google Auth │  │ Claude API /   │ │
│  │   OAuth    │  │    GPT-5       │ │
│  └────────────┘  └────────────────┘ │
└──────────────────────────────────────┘
```

### 2.2 Technology Stack

**Frontend:**
- React + TypeScript
- TailwindCSS for responsive design
- React Query for data fetching/caching
- React Router for navigation
- Vite for build tooling

**Backend:**
- Node.js + Express (or Python + FastAPI as alternative)
- TypeScript
- Passport.js for Google OAuth
- PostgreSQL for persistent storage
- Redis for caching artifacts and session management

**Infrastructure:**
- Docker containers for deployment
- Nginx as reverse proxy
- Optional: Deploy to Railway, Render, or AWS

## 3. Data Models

### 3.1 User Model

```typescript
interface User {
  id: string;              // UUID
  email: string;           // From Google Auth
  googleId: string;        // Google OAuth ID
  displayName: string;
  profilePicture?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### 3.2 Personality Profile Model

```typescript
interface PersonalityProfile {
  id: string;
  userId: string;

  // Probability distributions (DECISION #9: Must sum to 1.0)
  mbtiDistribution: {
    type: MBTIType;        // e.g., "INTJ"
    probability: number;   // 0-1 (renamed from confidence)
    precision: number;     // 0-1: confidence in this probability (DECISION #3)
  }[];

  enneagramDistribution: {
    type: EnneagramType;    // 1-9, with optional wing
    probability: number;    // 0-1
    precision: number;      // 0-1
  }[];

  big5Scores: {
    openness: number;          // 0-100
    openness_precision: number;  // 0-1 (DECISION #3)
    conscientiousness: number;
    conscientiousness_precision: number;
    extraversion: number;
    extraversion_precision: number;
    agreeableness: number;
    agreeableness_precision: number;
    neuroticism: number;
    neuroticism_precision: number;
  };

  updatedAt: Date;
}

type MBTIType =
  | "INTJ" | "INTP" | "ENTJ" | "ENTP"
  | "INFJ" | "INFP" | "ENFJ" | "ENFP"
  | "ISTJ" | "ISFJ" | "ESTJ" | "ESFJ"
  | "ISTP" | "ISFP" | "ESTP" | "ESFP";

type EnneagramType = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
  | "1w2" | "1w9" | "2w1" | "2w3" | ... ; // with wings
```

### 3.3 Statement Model

```typescript
interface PersonalityStatement {
  id: string;
  userId: string;
  statement: string;           // The actual statement text (max 500 chars - DECISION #8)
  credence: number;            // -1 (disagree), 0 (neutral/skipped), 1 (agree) - DECISION #3
  precision: number;           // 0-1: confidence/certainty in this credence - DECISION #3
  emphasized: boolean;         // True if user marked as core belief (2x weight) - DECISION #3
  category?: StatementCategory;
  source: StatementSource;     // How was this statement generated?
  userValidated: boolean;      // Has user explicitly agreed/disagreed?
  skipped: boolean;            // True if user clicked X (skip) - DECISION #3
  createdAt: Date;
  updatedAt: Date;
}

enum StatementCategory {
  WORK_STYLE = "work_style",
  SOCIAL = "social",
  DECISION_MAKING = "decision_making",
  STRESS_RESPONSE = "stress_response",
  COMMUNICATION = "communication",
  VALUES = "values",
  HABITS = "habits",
  OTHER = "other"
}

enum StatementSource {
  LLM_INFERRED = "llm_inferred",      // Generated by LLM from personality types
  USER_PROVIDED = "user_provided",     // User wrote this themselves
  QUESTIONNAIRE = "questionnaire",     // From initial assessment
  CHATGPT_IMPORT = "chatgpt_import"    // From ChatGPT prompt analysis - DECISION #1
}
```

### 3.4 Artifact Model

```typescript
interface Artifact {
  id: string;
  userId: string;
  type: ArtifactType;
  title: string;
  content: string;              // Markdown or HTML
  prompt: string;               // The prompt used to generate (max 1000 chars - DECISION #8)

  // DECISION #4: Fingerprint-based caching
  personalityFingerprint: PersonalityFingerprint;  // Snapshot at generation time
  deviationScore: number;       // 0-1: Current deviation from fingerprint
  needsRegeneration: boolean;   // True if deviation > threshold
  statementsUsed: string[];     // IDs of statements used in generation

  generatedBy: "claude-sonnet-4.5" | "gpt-4o";  // DECISION #2
  cachedAt: Date;

  // DECISION #7: Shareable artifacts
  shareId: string;              // Unique 8-char opaque ID for sharing
  isPublic: boolean;            // Privacy toggle
  shareViewCount: number;       // Views via share link

  viewCount: number;            // Total views (owner + share)
  lastViewedAt?: Date;
}

// DECISION #4: Personality fingerprint for deviation detection
interface PersonalityFingerprint {
  timestamp: Date;
  hash: string;  // SHA-256 of profile for quick comparison

  mbti: {
    type: MBTIType;
    probability: number;
    precision: number;
  }[];

  enneagram: {
    type: EnneagramType;
    probability: number;
    precision: number;
  }[];

  big5: {
    trait: string;  // 'openness', 'conscientiousness', etc.
    score: number;  // 0-100
    precision: number;
  }[];

  keyStatements: {
    id: string;
    text: string;
    credence: number;
    precision: number;
  }[];
}

enum ArtifactType {
  WORKDAY_GUIDE = "workday_guide",
  DATING_PROFILE = "dating_profile",
  CONFLICT_STYLE = "conflict_style",
  COMMUNICATION_GUIDE = "communication_guide",
  DECISION_FRAMEWORK = "decision_framework",
  CUSTOM = "custom"
}
```

### 3.5 Database Schema (PostgreSQL)

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  google_id VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255),
  profile_picture TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Personality profiles table
CREATE TABLE personality_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  mbti_distribution JSONB NOT NULL,
  enneagram_distribution JSONB NOT NULL,
  big5_scores JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Personality statements table (DECISION #3: added precision, emphasized, skipped)
CREATE TABLE personality_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  statement TEXT NOT NULL CHECK (length(statement) <= 500),  -- DECISION #8
  credence DECIMAL(3,2) NOT NULL CHECK (credence >= -1 AND credence <= 1),
  precision DECIMAL(3,2) DEFAULT 0.5 CHECK (precision >= 0 AND precision <= 1),  -- DECISION #3
  emphasized BOOLEAN DEFAULT FALSE,  -- DECISION #3
  skipped BOOLEAN DEFAULT FALSE,  -- DECISION #3
  category VARCHAR(50),
  source VARCHAR(50) NOT NULL,
  user_validated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_statements_user_id ON personality_statements(user_id);
CREATE INDEX idx_statements_category ON personality_statements(category);
CREATE INDEX idx_statements_uncertainty ON personality_statements(user_id, precision);  -- DECISION #3: for prioritization
CREATE INDEX idx_statements_emphasized ON personality_statements(user_id, emphasized) WHERE emphasized = TRUE;

-- Artifacts table (DECISION #4: fingerprints, DECISION #7: sharing)
CREATE TABLE artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  prompt TEXT NOT NULL CHECK (length(prompt) <= 1000),  -- DECISION #8

  -- DECISION #4: Fingerprint-based caching
  personality_fingerprint JSONB NOT NULL,
  deviation_score DECIMAL(3,2) DEFAULT 0,
  needs_regeneration BOOLEAN DEFAULT FALSE,
  statements_used JSONB NOT NULL,

  generated_by VARCHAR(20) NOT NULL,
  cached_at TIMESTAMP DEFAULT NOW(),

  -- DECISION #7: Shareable artifacts
  share_id VARCHAR(8) UNIQUE NOT NULL,
  is_public BOOLEAN DEFAULT FALSE,
  share_view_count INTEGER DEFAULT 0,

  view_count INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMP
);

CREATE INDEX idx_artifacts_user_id ON artifacts(user_id);
CREATE INDEX idx_artifacts_type ON artifacts(type);
CREATE INDEX idx_artifacts_share_id ON artifacts(share_id);  -- DECISION #7
CREATE INDEX idx_artifacts_outdated ON artifacts(user_id, deviation_score DESC) WHERE needs_regeneration = TRUE;  -- DECISION #4

-- Refresh tokens table (DECISION #6: 8hr access / 30day refresh with rotation)
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

-- LLM usage tracking (DECISION #2: Monitor costs)
CREATE TABLE llm_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  operation VARCHAR(50) NOT NULL,  -- 'artifact', 'statement', 'assessment'
  provider VARCHAR(50) NOT NULL,   -- 'claude-sonnet-4.5', 'gpt-4o'
  tokens_input INTEGER NOT NULL,
  tokens_output INTEGER NOT NULL,
  cost_usd DECIMAL(10,6) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_llm_usage_user_date ON llm_usage(user_id, created_at);
CREATE INDEX idx_llm_usage_date ON llm_usage(created_at);
CREATE INDEX idx_llm_usage_operation ON llm_usage(operation);
```

## 4. Core Features & User Flows

### 4.1 Authentication Flow

1. User visits app
2. Clicks "Sign in with Google"
3. Google OAuth flow redirects to consent screen
4. User approves
5. Server receives OAuth token, creates/retrieves user record
6. Server creates session (JWT or session cookie)
7. User redirected to dashboard

### 4.2 Initial Personality Assessment (DECISION #1: Multi-path onboarding)

**User selects from 4 onboarding paths:**

**Path 1: "Get analysis from ChatGPT" (RECOMMENDED)**
1. User sees copyable prompt template
2. User pastes prompt into ChatGPT, gets structured response
3. User pastes ChatGPT response back into app
4. App parses response → extracts MBTI, Enneagram, Big5, statements
5. User reviews and validates 20-25 imported statements (👍/👎/❌/✏️)

**Path 2: "I know my types"**
1. User manually enters MBTI, Enneagram, Big5 scores
2. Optional: User provides self-description text box
3. If self-description provided: LLM generates 15-20 statements
4. User validates generated statements

**Path 3: "Take conversational assessment"**
1. LLM-driven adaptive Q&A (5-10 exchanges)
2. LLM analyzes responses → generates profile + statements
3. User validates statements

**Path 4: "Skip for now"**
1. User starts with blank profile
2. Can manually add statements
3. Can take assessment later from profile page

**All paths converge to:**
- User has personality profile (MBTI/Enneagram/Big5 with precision)
- User has 10-25 validated statements
- User can immediately generate first artifact

### 4.3 Personality Profile Page

**Layout:**
- Top section: "Your Personality Summary"
  - MBTI distribution (e.g., "75% INTJ, 20% INTP, 5% ENTJ")
  - Enneagram distribution (e.g., "60% Type 5w4, 30% Type 1")
  - Big5 scores (visual sliders or bars)

- Middle section: "Key Statements About You" (DECISION #3: Binary + precision + emphasis)
  - Filterable by category
  - Sortable by uncertainty (1 - precision) for prioritization
  - Each statement shows:
    - Statement text (with ⭐ if emphasized)
    - Current credence: 👍 (agree), 👎 (disagree), or - (skipped)
    - Precision: Visual confidence indicator (0-1)
    - Actions:
      - 👍 Agree | 👎 Disagree | ❌ Skip
      - ⭐ Emphasize (marks as core belief, 2x weight)
      - ✏️ Rephrase (inline editing)
      - 🗑️ Delete

- Bottom section: "Add New Statement"
  - Text input to add custom statements
  - Optional: "Generate more statements" button

### 4.4 Artifact Generation Flow (DECISION #4: Fingerprint-based caching)

1. User navigates to "Generate Guide"
2. Selects artifact type (or enters custom prompt)
3. System calculates current profile hash (SHA-256 of profile + validated statements)
4. System checks cache:
   - Cache key: `artifact:{userId}:{artifactType}:{profileHash}`
   - If cache hit: Return cached artifact (Redis or database)
5. If cache miss (new or profile changed):
   - Create personality fingerprint (snapshot of current profile)
   - Construct prompt from profile + statements + artifact type
   - Call LLM API (Claude Sonnet 4.5 - DECISION #2)
   - Generate unique 8-char share ID (DECISION #7)
   - Save response as artifact with fingerprint
   - Cache in Redis with 30-day TTL
   - Store in database
6. Display artifact to user
7. **Deviation detection:** System continuously calculates deviation between current profile and artifact fingerprint
8. If deviation > 0.30: Show "Profile changed - Regenerate?" banner
9. User can:
   - Regenerate (invalidates cache, creates new with diff-aware prompt)
   - View changes (see what changed since generation)
   - Share artifact (toggle public, copy share link)
   - Edit statements inline in artifact (interactive artifacts)

### 4.5 Custom Prompts & Statement Generation (Decisions #10-11)

**Custom Artifact Prompts:**
- **V1 (MVP):** Predefined templates only
  - 5 templates: Workday Guide, Communication Style, Decision Framework, Conflict Style, Dating Profile
  - No custom prompts (prevents prompt injection and quality issues)
- **V2+:** Custom prompts with sanitization
  - User can enter custom prompt (1000 char limit)
  - Sanitization: Remove HTML/script tags, prevent prompt injection
  - Template scaffolding wraps user input safely
  - Preview before generation

**Statement Generation Strategy:**
- **Initial onboarding:** 20-25 statements (from ChatGPT import or LLM)
- **After onboarding:** User-triggered only via "Generate more statements" button
- **No automatic generation:** Prevents overwhelming users
- **Information-theoretic prioritization:** Suggest reviewing uncertain statements (low precision) first
- **Smart prompts:** "You have 15 validated statements. Add 5 more for better artifacts."
- **Generation batch size:** 10 new statements per request (not 50+)
- **LLM generates based on:**
  1. Current personality types (fill gaps)
  2. Statement categories with few examples
  3. Contradictions in existing statements (resolve ambiguity)

**Rationale:**
- Start simple with curated templates (V1)
- Add custom prompts once we understand usage patterns (V2)
- User stays in control (no surprise statement generation)
- Quality over quantity (20 well-validated > 100 uncertain statements)

### 4.6 Profile Updates & Statement Management (Decisions #16-17)

**Profile Update Mechanism:**
- Statements are informational only
- Do NOT automatically update MBTI/Enneagram/Big5 when user validates statements
- "Re-evaluate personality types" button:
  1. Analyzes all validated statements
  2. LLM suggests updated distributions
  3. Shows comparison: "Your analysis suggests: INTJ (85%) vs previous INTJ (75%)"
  4. User approves or rejects changes
- Prevents confusing auto-updates

**Statement Deduplication:**
- **MVP:** No automated deduplication (manual removal only)
- **V2+:** Show "similar statements" warning using embeddings
- Rationale: Not critical for MVP, users won't create many duplicates manually

**Artifact Versioning:**
- **MVP:** Single latest version only (regenerating overwrites)
- **V2+:** Add version history with "View history" feature
- Rationale: Simpler data model, users care about current artifact

**Big5 Score Input:**
- Initial assessment: LLM infers Big5 from MBTI + Enneagram + statements
- Profile page: Sliders for each trait (0-100)
- User can adjust manually (user-adjusted = high precision)
- No separate Big5 questionnaire (avoids 44-120 question test)

## 5. Key Services & Components

### 5.1 Profile Service

**Responsibilities:**
- Calculate personality type distributions
- Update profiles based on user feedback
- Generate new personality statements via LLM
- Track confidence scores

**Key Methods:**
- `updateMBTIDistribution(userId, userResponses)`
- `updateStatementCredence(statementId, credence)`
- `generateStatementsFromProfile(userId, count)`
- `getProfileSummary(userId)`

### 5.2 Artifact Generation Service

**Responsibilities:**
- Construct prompts for LLM
- Manage caching strategy
- Call LLM APIs
- Store generated content

**Key Methods:**
- `generateArtifact(userId, type, customPrompt?)`
- `getCachedArtifact(userId, type, profileHash)`
- `invalidateCache(userId)` // When profile changes significantly

**Caching Strategy:** (DECISION #4: Fingerprint-based with deviation detection)
- Cache key: `artifact:{userId}:{type}:{profileHash}`
- Profile hash: SHA-256 of (MBTI dist + Enneagram dist + Big5 + validated statements)
- TTL: 30 days (Redis) or indefinite (database)
- Cache invalidation: User-triggered (not automatic)
- Deviation calculation: Precision-weighted distance between fingerprints
- Thresholds:
  - 0.15: Notify user (yellow badge)
  - 0.30: Suggest regeneration (orange banner)
  - 0.50: Significantly outdated (red warning)
- Diff-aware regeneration: LLM receives previous artifact + change summary

### 5.3 LLM Integration Service (DECISION #2: Claude Sonnet 4.5 with abstraction layer)

**Responsibilities:**
- Abstract LLM provider (easy swapping between Claude, GPT, etc.)
- Handle rate limiting (20 artifacts, 10 statements, 3 assessments per day)
- Retry logic with exponential backoff
- Cost tracking and monitoring
- Fallback to secondary provider if primary fails

**Provider Configuration:**
```typescript
interface LLMProvider {
  generateCompletion(prompt: string, options?: LLMOptions): Promise<string>;
  generateStreaming(prompt: string, options?: LLMOptions): AsyncIterator<string>;
  estimateCost(prompt: string, completion: string): number;
}

const LLM_CONFIG = {
  primary: 'claude-sonnet-4.5',
  fallback: 'gpt-4o',
  providers: {
    'claude-sonnet-4.5': new ClaudeProvider(),
    'gpt-4o': new GPTProvider(),
  }
};
```

**Daily Limits (Abuse Prevention):** (Decision #12)
- Artifact generation: 20/day per user
- Statement generation: 10/day per user
- Conversational assessment: 3/day per user
- No monthly caps (trust users, monitor usage)
- No global budget limit (willing to spend as needed)

**LLM Response Validation:** (Decision #14)
- **Length validation:** Min 100 chars, max 10,000 chars for artifacts
- **Format validation:** Must be valid markdown with headers
- **Security check:** No script tags or event handlers
- **Retry logic:** If validation fails, retry once with "fix your response" prompt
- **No hallucination detection:** Trust LLM for personality content
- **ChatGPT import validation:** Validate JSON structure for onboarding path

```typescript
function validateArtifactResponse(response: string): ValidationResult {
  // 1. Length check
  if (response.length < 100 || response.length > 10000) {
    return { valid: false, error: "Invalid length",
             fixPrompt: "Generate response between 100-10000 characters" };
  }

  // 2. Format check (basic markdown)
  const hasHeaders = /^#+\s+/m.test(response);
  if (!hasHeaders) {
    return { valid: false, error: "Missing headers",
             fixPrompt: "Generate properly formatted markdown with headers" };
  }

  // 3. Security check
  if (/<script/i.test(response) || /on\w+\s*=/i.test(response)) {
    return { valid: false, error: "Security violation",
             fixPrompt: "Remove HTML script tags or event handlers" };
  }

  return { valid: true };
}

// Retry logic
async function generateArtifactWithRetry(userId: string, type: string): Promise<string> {
  const prompt = constructArtifactPrompt(userId, type);
  let response = await llm.generateCompletion(prompt);
  let validation = validateArtifactResponse(response);

  if (validation.valid) return response;

  // Retry once with fix prompt
  console.warn('Invalid LLM response, retrying...', validation.error);
  response = await llm.generateCompletion(`${prompt}\n\nIMPORTANT: ${validation.fixPrompt}`);
  validation = validateArtifactResponse(response);

  if (!validation.valid) {
    throw new Error(`LLM validation failed after retry: ${validation.error}`);
  }

  return response;
}
```

**Prompt Engineering:**

```
Example prompt for "Ideal Workday Guide":

You are a personality expert creating a personalized ideal workday guide.

User's Personality Profile:
- MBTI: {mbti_distribution}
- Enneagram: {enneagram_distribution}
- Big5 Scores: {big5_scores}

Key Validated Statements (credence > 0.5):
{list_of_accepted_statements}

Generate a detailed "Ideal Workday Guide" that:
1. Accounts for their energy patterns
2. Optimizes for their work style preferences
3. Includes breaks and social interaction calibrated to their needs
4. Provides specific recommendations for productivity

Format as markdown with clear sections.
```

## 6. UI/UX Design

### 6.1 Page Structure

1. **Landing Page** (logged out)
   - Hero section explaining value prop
   - "Sign in with Google" CTA
   - Sample personality insights

2. **Dashboard** (logged in)
   - Quick stats: Profile completeness, # of artifacts
   - Navigation to: Profile, Generate Artifact, Settings

3. **Personality Profile Page**
   - Tabbed interface:
     - Overview (types + distributions)
     - Statements (filterable list)
     - History (how profile has evolved)

4. **Generate Artifact Page**
   - Template selection (predefined types)
   - Custom prompt input
   - Preview of cached artifacts
   - Generation button

5. **Artifact View Page**
   - Rendered artifact content
   - Metadata (generated date, model used)
   - Regenerate button
   - Share/export options

### 6.2 Responsive Design Considerations

- Mobile-first approach
- Statements should be swipeable on mobile (Tinder-like for agree/disagree)
- Collapsible sections for personality type distributions
- Bottom navigation on mobile, sidebar on desktop

## 7. API Endpoints

### Authentication
- `POST /api/auth/google` - Initiate Google OAuth
- `GET /api/auth/google/callback` - OAuth callback
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Profile
- `GET /api/profile` - Get current user's personality profile
- `PUT /api/profile/mbti` - Update MBTI distribution
- `PUT /api/profile/enneagram` - Update Enneagram distribution
- `PUT /api/profile/big5` - Update Big5 scores

### Statements (DECISION #3: Binary credence + precision + emphasis)
- `GET /api/statements` - List all statements (with filters: category, emphasized, skipped)
- `POST /api/statements` - Create new statement
- `PUT /api/statements/:id` - Update statement credence, precision, or text
- `PUT /api/statements/:id/emphasize` - Toggle emphasis (DECISION #3)
- `PUT /api/statements/:id/skip` - Skip statement (DECISION #3)
- `DELETE /api/statements/:id` - Delete statement (returns affected artifacts)
- `POST /api/statements/generate` - Generate new statements via LLM

### Artifacts (DECISION #4: Fingerprints, DECISION #7: Sharing)
- `GET /api/artifacts` - List user's artifacts (with deviation scores)
- `GET /api/artifacts/:id` - Get specific artifact
- `POST /api/artifacts/generate` - Generate new artifact
  - Body: `{ type, customPrompt? }`
  - Returns: Artifact with fingerprint and share ID
- `PUT /api/artifacts/:id/regenerate` - Regenerate with diff-aware prompt
- `PUT /api/artifacts/:id/share` - Toggle public/private (DECISION #7)
- `POST /api/artifacts/:id/share/regenerate-id` - Generate new share ID
- `DELETE /api/artifacts/:id` - Delete artifact
- `GET /share/:shareId` - Public route for shared artifacts (no auth)

### Analytics
- `GET /api/usage/llm` - LLM cost tracking for user
- `GET /api/usage/summary` - Dashboard stats (artifact count, profile completeness)

## 8. Security & Privacy

### Authentication & Authorization (DECISION #6: 8hr/30day JWT)
- All API endpoints require authentication (except auth endpoints and /share/:shareId)
- **Access tokens:** 8-hour expiration (HS256)
- **Refresh tokens:** 30-day expiration with rotation
- Refresh tokens stored in database (revocable)
- HttpOnly cookies for token storage (not localStorage)
- CSRF protection for state-changing operations
- CORS configuration for frontend domain only
- Multi-device sessions allowed with session management UI

### Data Privacy & Deletion (Decision #13)

**User Data Deletion:**
- **Users:** Soft delete with 30-day recovery window
  1. User clicks "Delete Account"
  2. Account marked as `deleted_at: Date` (soft delete)
  3. User cannot login but can recover via email link
  4. After 30 days: Cron job hard deletes account + all data
  5. Email freed up for re-registration
- **Statements:** Hard delete immediately (easily regenerated)
- **Artifacts:** Hard delete immediately (easily regenerated)
- **LLM usage logs:** Anonymized on user deletion (GDPR compliance)

```typescript
// Soft delete user
async function softDeleteUser(userId: string): Promise<void> {
  await db.users.update({
    where: { id: userId },
    data: {
      deleted_at: new Date(),
      email: `deleted_${userId}@example.com`
    }
  });

  await sendEmail(user.email, {
    subject: "Account deletion scheduled",
    body: `Your account will be deleted in 30 days. Click to cancel: ${recoveryLink}`
  });
}

// Cron job: Hard delete after 30 days
async function hardDeleteExpiredUsers(): Promise<void> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const expiredUsers = await db.users.findMany({
    where: { deleted_at: { lte: thirtyDaysAgo } }
  });

  for (const user of expiredUsers) {
    await db.users.delete({ where: { id: user.id } });  // Cascades to all data
    await redis.del(...await redis.keys(`artifact:${user.id}:*`));
    await db.llm_usage.updateMany({
      where: { userId: user.id },
      data: { userId: 'DELETED', anonymized: true }
    });
  }
}
```

**Data Access:**
- Users can only access their own data
- No data sharing between users
- Encrypted environment variables for API keys
- GDPR compliance: Right to erasure honored after 30 days

### Rate Limiting (DECISION #2)
- Per-user daily limits (prevent API abuse):
  - Artifact generation: 20/day
  - Statement generation: 10/day
  - Conversational assessment: 3/day
- Graceful error messages with retry time
- Admin dashboard for monitoring usage

### Input Validation (DECISION #8)
**Text Length Limits:**
- Statement text: 10-500 characters
- Custom artifact prompt: 20-1000 characters
- Display name: 2-100 characters

**Per-User Limits:**
- Statements: 1000 max (soft cap at 500 with warning)
- Artifacts: 200 max (soft cap at 100 with warning)

**Validation:**
- Zod schemas for type safety
- Regex patterns for allowed characters
- Async validation for uniqueness checks
- Clear error messages

### Error Handling & User Communication (Decision #15)

**Error Communication Strategy:**
- **Toast notifications:** Transient errors (network, temporary failures)
- **Modal dialogs:** Critical errors (data loss, auth failure, rate limits)
- **Inline validation:** Form errors (invalid input, field-level)
- **Banner notifications:** System-wide issues (maintenance, API down)

**Error Message Templates:**
```typescript
const ERROR_MESSAGES = {
  LLM_API_FAILURE: {
    title: "Generation failed",
    message: "Our AI service is temporarily unavailable. Try again in a few minutes.",
    action: "Retry",
    type: "toast"
  },
  RATE_LIMIT: {
    title: "Daily limit reached",
    message: "You've generated 20 artifacts today. Try again tomorrow.",
    action: "View Usage",
    type: "modal"
  },
  INVALID_INPUT: {
    title: "Invalid input",
    message: "Statement must be 10-500 characters.",
    action: "Fix",
    type: "inline"
  },
  NETWORK_ERROR: {
    title: "Connection lost",
    message: "Check your internet connection and try again.",
    action: "Retry",
    type: "toast"
  },
  SERVER_ERROR: {
    title: "Something went wrong",
    message: "We're working on it. Try again in a few minutes.",
    action: "Dismiss",
    type: "toast"
  },
  AUTH_EXPIRED: {
    title: "Session expired",
    message: "Your session has expired. Please sign in again.",
    action: "Sign In",
    type: "modal"
  }
};

// Error handling wrapper
async function handleApiCall<T>(apiCall: () => Promise<T>, errorContext: string): Promise<T> {
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
      Sentry.captureException(error, { context: errorContext });
      showToast(ERROR_MESSAGES.SERVER_ERROR);
    }
    throw error;
  }
}
```

**User-Friendly Error Examples:**
- ❌ Bad: "Error 429: Too Many Requests"
- ✅ Good: "You've generated 20 artifacts today. Try again tomorrow at 12:00 AM."
- ❌ Bad: "ECONNREFUSED"
- ✅ Good: "Connection lost. Check your internet and try again."

### Shareable Artifacts (DECISION #7)
**Features:**
- Each artifact gets unique 8-character share ID (e.g., `x7k2p9M4`)
- Public route: `/share/{shareId}` (no auth required)
- Privacy toggle per artifact (default: private)
- Share view count tracking
- Copy link button with clipboard integration

**Share Page Display:**
- Artifact content (read-only)
- Author display name (optional)
- Generated date
- "Create your own personality profile" CTA
- No edit/delete actions (view only)

**Privacy Controls:**
- User can toggle public/private per artifact
- Making private immediately invalidates share link
- User can regenerate share ID (new random ID)

## 9. Development Best Practices (Decisions #20-23)

### 9.1 Database Transactions (Decision #20)

**Operations Requiring Transactions:**
- User creation + profile initialization + initial statements
- Artifact generation + fingerprint storage + caching
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
- Data consistency: Multi-step operations either fully succeed or fully fail
- No partial state: Prevent orphaned records
- PostgreSQL transactions are reliable and performant

### 9.2 Monitoring & Observability (Decision #21)

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
- **No alerts:** Manual review of logs/metrics for MVP

**V2+ Enhancements:**
- Sentry for error tracking
- Grafana dashboards
- Alerts for critical thresholds
- Distributed tracing (OpenTelemetry)

**Rationale:**
- Start simple: Don't over-engineer observability for MVP
- Railway provides basics: Built-in logs and metrics
- Manual review sufficient at low user count
- Easy to enhance later without changing code

### 9.3 Database Backup & Recovery (Decision #22)

**Strategy:**
- **Railway PostgreSQL addon:** Automatic daily backups
- **Retention:** 30-day retention (Railway default)
- **Recovery:** Use Railway dashboard to restore from backup
- **No custom backup logic:** Trust managed service
- **V1 (SQLite):** Manual backup of .db file

**Rationale:**
- Managed service reliability: Railway handles backups automatically
- Cost-effective: Included in managed PostgreSQL pricing
- Simple recovery: One-click restore via dashboard
- 30-day retention covers accidental deletion scenarios

### 9.4 Testing Strategy (Decision #23)

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
    expect(calculateDeviation(old, new)).toBeGreaterThan(0);
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
    expect(generateShareId()).toHaveLength(8);
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

**Watch Mode for Development:**
```bash
# Tests auto-run on file save
npm run test:watch
```

**Not Tested (Deferred to V2):**
- Integration tests (database + API)
- E2E tests (full user flows)
- Visual regression tests
- Performance tests

**Rationale:**
- Fast feedback: Unit tests run in <1s, don't slow down development
- Confidence: Test core logic prevents regressions
- Documentation: Tests serve as examples
- Claude-friendly: Fast tests mean immediate verification of changes

## 10. Deployment Strategy (Railway.app)

### Development Environment (V1: Single-User)
- **Local:** Node.js + SQLite (file-based database)
- **No auth:** Hardcoded single user (`userId = 'default'`)
- **In-memory caching:** No Redis needed
- **Simple:** `npm run dev` to start

### Production Environment (V2+: Multi-User)
- **Platform:** Railway.app (single platform for all services)
- **Frontend:** React build served by Express (or separate Vercel deploy)
- **Backend:** Express + TypeScript on Railway
- **Database:** PostgreSQL addon on Railway
- **Redis:** Redis addon on Railway
- **Deployment:** `git push` → automatic deploy
- **Environment variables:** Railway dashboard or CLI
- **Monitoring:** Railway built-in metrics

### Railway Setup
```bash
# Install CLI
npm install -g @railway/cli

# Login and init
railway login
railway init

# Add services (V2+)
railway add postgresql
railway add redis

# Deploy
railway up

# View logs
railway logs
```

### Migration Path: V1 → V2
1. V1: Local dev with SQLite, single-user
2. Deploy V1 to Railway (still single-user, SQLite)
3. Add multi-user: Create users table, add Google OAuth
4. Switch to PostgreSQL addon
5. Add Redis addon for caching
6. Migrate V1 data to V2 schema

### CI/CD
- **Simple:** Railway auto-deploys on git push to main
- **Optional:** GitHub Actions for:
  - Linting & type checking
  - Unit tests
  - Integration tests
  - Then deploy to Railway via railway up

## 10. Deferred Decisions (24-48) - Post-MVP Features

The following 25 decisions are deferred to post-MVP with sensible defaults for V1. These features are not critical for validating the core concept and can be added later based on user feedback.

**24. Mobile Interaction Patterns:**
- **MVP:** Swipe for agree/disagree (Tinder-style) + tap to expand
- **V2+:** Advanced gestures, haptic feedback

**25. Statement Presentation Order:**
- **MVP:** Category-grouped, sorted by credence within category
- **V2+:** Personalized sorting based on user behavior

**26. Visual Design Style:**
- **MVP:** Minimalist/modern (like Notion, Linear)
- **V2+:** Themeable, dark mode

**27. Artifact Display Format:**
- **MVP:** Markdown rendered as HTML, read-only
- **V2+:** PDF export, DOCX export, interactive embeds

**28. Profile Completeness Indicator:**
- **MVP:** Yes - percentage based on validated types + statements
- **Formula:** `(hasAllTypes + validatedStatements/20) / 2 * 100`

**29. Statement Privacy & Sharing:**
- **MVP:** Fully private (covered by Decision #7 for artifacts)
- **V2+:** Optional social features for statement sharing

**30. Real-time Updates:**
- **MVP:** No real-time, user refreshes to see updates
- **V2+:** WebSocket connections for collaborative features

**31. File Storage for Artifacts:**
- **MVP:** Markdown/HTML only stored in database
- **V2+:** PDF generation, DOCX export, cloud storage integration

**32. Monetization Strategy:**
- **MVP:** Fully free (no paywalls, no ads)
- **V2+:** Evaluate pricing based on LLM costs and user feedback
- **Potential models:** Freemium, premium artifacts, team plans

**33. Data Retention:**
- **MVP:** Keep indefinitely, manual delete option (covered by Decision #13)
- **V2+:** Automated archival of old artifacts

**34. Analytics & Telemetry:**
- **MVP:** Basic analytics via PostgreSQL queries
- **V2+:** Third-party analytics (Posthog, Mixpanel)

**35. Onboarding Flow:**
- **MVP:** Multi-path assessment (covered by Decision #1)
- **V2+:** Interactive onboarding tour, progress tracking

**36. Frontend State Management:**
- **MVP:** React Query + Context (no Redux)
- **Rationale:** Sufficient for MVP, React Query handles server state well

**37. API Versioning:**
- **MVP:** No versioning (/api/*)
- **V2+:** Add /api/v1/ when API stabilizes for backward compatibility

**38. Accessibility Level:**
- **MVP:** Basic keyboard navigation + semantic HTML
- **V2+:** Work toward WCAG 2.1 Level AA compliance
- **Features deferred:** Screen reader optimization, focus management, ARIA labels

**39. Loading States:**
- **MVP:** Skeleton screens for lists, spinners for actions, progress bars for LLM generation
- **V2+:** Optimistic UI updates, streaming LLM responses

**40. Email Notifications:**
- **MVP:** No emails
- **V2+:** Transactional emails (account deletion, password reset), weekly insights

**41. Statement Weighting:**
- **MVP:** Emphasis feature (covered by Decision #3) - 2x multiplier
- **No other weighting needed for MVP**

**42. Profile Snapshot Versioning:**
- **MVP:** Store full snapshot in artifact fingerprint
- **V2+:** Optimize storage with delta compression

**43. Multi-device Sessions:**
- **MVP:** Multiple sessions allowed, no management UI
- **V2+:** "Active sessions" page, "Logout all devices" button

**44. GDPR Data Export:**
- **MVP:** "Delete Account" button (covered by Decision #13)
- **V2+:** "Export my data" button (JSON download of all user data)

**45. Personality Framework Bias:**
- **MVP:** Add disclaimer about MBTI/Enneagram limitations
- **Focus:** User-validated statements as ground truth (not framework types)
- **Disclaimer:** "Personality frameworks are models, not absolute truths. Your validated statements are the most important data."

**46. Artifact Regeneration Strategy:**
- **MVP:** Invalidate cache, overwrite existing artifact (covered by Decision #4)
- **V2+:** Keep version history, compare versions side-by-side

**47. Statement Categorization:**
- **MVP:** Optional LLM-suggested category, user can edit, default to "OTHER"
- **V2+:** Auto-categorization with confidence scores

**48. Statement Source Tracking:**
- **MVP:** Display as subtle badge ("From ChatGPT", "LLM-generated", "User-written")
- **Use:** Set default precision values based on source
- **V2+:** Filter by source, bulk operations by source

### Rationale for Batch Deferral

- **MVP focus:** These don't block core functionality (profile + statements + artifacts)
- **User feedback needed:** Better to ship MVP and learn what users actually want
- **Easy to add later:** None require major architectural changes
- **Avoid over-engineering:** Don't build features users might not need
- **Faster validation:** Ship in 2-3 weeks vs 10+ weeks with all features

## 11. Future Enhancements (Out of Scope for MVP)

- Statement import from journaling apps
- Collaborative profiles (for couples, teams)
- API for third-party integrations
- Mobile native apps (React Native)
- Voice-based personality assessment
- Timeline view of personality evolution
- Personality compatibility matching
- Export data in standardized format
- Multi-language support
- Custom artifact templates (user-created)
- Statement similarity detection (avoid duplicates)
- Bulk statement import/export

## 11. Success Metrics

- User engagement: % of users who validate >10 statements
- Artifact generation rate: Avg artifacts generated per user per month
- Profile completeness: % of users with validated MBTI/Enneagram/Big5
- Return visits: % of users who return within 7 days
- Cache hit rate: % of artifact requests served from cache

## 12. Development Phases

### Phase 1: Core Infrastructure (Week 1-2)
- Setup project structure
- Database schema & migrations
- Google OAuth integration
- Basic API scaffolding
- Frontend routing & layout

### Phase 2: Personality Profile (Week 3-4)
- Profile data models
- Statement CRUD operations
- Profile page UI
- Initial assessment questionnaire

### Phase 3: LLM Integration (Week 5-6)
- LLM service abstraction
- Prompt templates
- Statement generation
- Basic artifact generation

### Phase 4: Artifact System (Week 7-8)
- Artifact models & storage
- Caching layer
- Artifact generation UI
- Template system

### Phase 5: Polish & Deploy (Week 9-10)
- Responsive design refinements
- Error handling
- Loading states
- Deployment setup
- Documentation

---

## Technology Decisions Summary

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Frontend Framework | React + TypeScript | Industry standard, type safety, large ecosystem |
| Styling | TailwindCSS | Rapid development, responsive utilities, customizable |
| Backend Framework | Express + TypeScript | Simple, flexible, good for API servers |
| Database | PostgreSQL | JSONB support for distributions, robust, scalable |
| Cache | Redis | Fast, TTL support, widely used |
| Auth | Passport.js + Google OAuth | Easy integration, secure |
| LLM Provider | Claude API (primary) | High quality outputs, good for personality analysis |
| Deployment | Docker + Railway/Render | Easy deployment, cost-effective |
