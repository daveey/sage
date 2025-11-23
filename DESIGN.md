# Personality Profiling App - Design Document

## 1. Overview

A web-based application that builds and maintains detailed personality profiles for users, then generates personalized artifacts (guides, templates, recommendations) based on those profiles.

### Core Value Proposition
Users receive highly personalized content by maintaining a living personality profile that combines established psychological frameworks (MBTI, Enneagram, Big5) with dynamic, user-validated statements about their preferences, behaviors, and traits.

### Design Decisions Status - SIMPLIFIED FOR MVP

This design has been **simplified based on architecture critique** to enable faster MVP validation. Key simplifications:

**✂️ Removed from V1 (Deferred to V2):**
- ❌ Precision/emphasis/skipped on statements → **Simple binary agree/disagree**
- ❌ Fingerprint-based caching with deviation → **Simple cache invalidation on change**
- ❌ ChatGPT import path → **Manual entry only**
- ❌ Big5 personality framework → **MBTI + Enneagram only**
- ❌ Share links for artifacts → **Private only**
- ❌ Soft delete with recovery → **Hard delete**
- ❌ Information-theoretic prioritization → **Random order**
- ❌ Diff-aware LLM prompting → **Full regeneration**
- ❌ Multi-device session management → **Single session**

**✅ V1 Core (True MVP - 1 week):**
1. Simple personality profile (MBTI + Enneagram distributions)
2. Statement validation (binary agree/disagree only)
3. Artifact generation (5 predefined templates)
4. Basic caching (invalidate on any profile change)
5. Google OAuth with 15-min JWT tokens
6. Normalized database schema (PostgreSQL tables, not JSONB)
7. Fast unit tests (<1s with Vitest)
8. Hard delete only (no soft delete complexity)

**✅ V2 Additions (After MVP Validation):**
- Precision/emphasis on statements
- Fingerprint-based smart caching
- Big5 support with sliders
- Share links for artifacts
- Soft delete with recovery
- Advanced features from original design

**See MILESTONES.md for phased development plan.**

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

### 3.2 Personality Profile Model (SIMPLIFIED for V1)

```typescript
interface PersonalityProfile {
  id: string;
  userId: string;
  version: number;  // For optimistic locking

  // V1: Simple - No precision, no Big5
  // Distributions stored in separate tables (normalized schema)

  updatedAt: Date;
  createdAt: Date;
}

// Separate table for MBTI (normalized, queryable)
interface PersonalityProfileMBTI {
  profileId: string;
  type: MBTIType;
  probability: number;  // 0-1, must sum to 1.0 for profile
  PRIMARY KEY (profileId, type);
}

// Separate table for Enneagram (normalized, queryable)
interface PersonalityProfileEnneagram {
  profileId: string;
  type: EnneagramType;
  probability: number;  // 0-1, must sum to 1.0 for profile
  PRIMARY KEY (profileId, type);
}

// V2+: Add precision column to both tables
// V2+: Add Big5 support with separate table

type MBTIType =
  | "INTJ" | "INTP" | "ENTJ" | "ENTP"
  | "INFJ" | "INFP" | "ENFJ" | "ENFP"
  | "ISTJ" | "ISFJ" | "ESTJ" | "ESFJ"
  | "ISTP" | "ISFP" | "ESTP" | "ESFP";

type EnneagramType = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
  | "1w2" | "1w9" | "2w1" | "2w3" | ... ; // with wings
```

### 3.3 Statement Model (SIMPLIFIED for V1)

```typescript
interface PersonalityStatement {
  id: string;
  userId: string;
  statement: string;        // Max 500 chars
  credence: number;         // V1: -1 (disagree), 0 (not validated), 1 (agree)
                            // V2+: Add precision, emphasis, skipped
  category?: StatementCategory;
  source: StatementSource;
  userValidated: boolean;   // Has user clicked agree/disagree?
  createdAt: Date;
  updatedAt: Date;
}

// V1 Simplifications:
// - No precision field (defer to V2)
// - No emphasized field (defer to V2)
// - No skipped field (just leave credence=0)
// - Binary: User either agrees (1), disagrees (-1), or hasn't validated (0)

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

### 3.4 Artifact Model (SIMPLIFIED for V1)

```typescript
interface Artifact {
  id: string;
  userId: string;
  type: ArtifactType;
  title: string;
  content: string;              // Markdown
  prompt: string;               // The template used (predefined only for V1)

  generatedBy: "claude-sonnet-4.5" | "gpt-4o";
  createdAt: Date;
  updatedAt: Date;
}

// V1 Simplifications:
// - No fingerprints (simple cache invalidation: regenerate when profile changes)
// - No deviation detection (always show "Profile may have changed" if updatedAt > createdAt)
// - No share links (artifacts are private only)
// - No view counts
// - Cache key: artifact:{userId}:{type}:latest (invalidate on profile change)

// V2+: Add back fingerprints, share links, deviation detection

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

### 3.5 Database Schema (PostgreSQL) - SIMPLIFIED & NORMALIZED

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

-- Personality profiles table (V1: Simple, no JSONB)
CREATE TABLE personality_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  version INTEGER DEFAULT 1,  -- For optimistic locking
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

-- MBTI distribution (Normalized - queryable!)
CREATE TABLE personality_profile_mbti (
  profile_id UUID REFERENCES personality_profiles(id) ON DELETE CASCADE,
  type VARCHAR(4) NOT NULL CHECK (type IN ('INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP','ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP')),
  probability DECIMAL(3,2) NOT NULL CHECK (probability >= 0 AND probability <= 1),
  PRIMARY KEY (profile_id, type)
);

-- Enneagram distribution (Normalized - queryable!)
CREATE TABLE personality_profile_enneagram (
  profile_id UUID REFERENCES personality_profiles(id) ON DELETE CASCADE,
  type VARCHAR(10) NOT NULL,  -- "1", "2", "1w2", etc.
  probability DECIMAL(3,2) NOT NULL CHECK (probability >= 0 AND probability <= 1),
  PRIMARY KEY (profile_id, type)
);

-- V2+: Add precision column to both tables above
-- V2+: Add personality_profile_big5 table

-- Personality statements table (V1: Simplified - no precision, emphasized, skipped)
CREATE TABLE personality_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  statement TEXT NOT NULL CHECK (length(statement) <= 500 AND length(statement) >= 10),
  credence SMALLINT NOT NULL CHECK (credence IN (-1, 0, 1)),  -- Binary for V1
  category VARCHAR(50),
  source VARCHAR(50) NOT NULL,
  user_validated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_statements_user_id ON personality_statements(user_id);
CREATE INDEX idx_statements_validated ON personality_statements(user_id, user_validated) WHERE user_validated = TRUE;

-- Artifacts table (V1: Simplified - no fingerprints, no sharing)
CREATE TABLE artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  prompt TEXT NOT NULL,  -- Predefined template name for V1
  generated_by VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, type)  -- One artifact per type per user (overwrite on regenerate)
);

CREATE INDEX idx_artifacts_user_id ON artifacts(user_id);

-- V2+: Add share_id, is_public, personality_fingerprint, deviation_score

-- Refresh tokens table (V1: 15min access / 30day refresh with rotation)
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL,  -- SHA-256 hash of token
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP,
  revoked BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);

-- V1 Simplification: No user_agent or ip_address tracking (defer to V2)

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

### 4.2 Initial Personality Assessment (SIMPLIFIED for V1)

**V1: Single simple path (no ChatGPT integration complexity)**

**Onboarding Flow:**
1. User signs in with Google
2. **"Tell us about yourself"** page:
   - User manually enters MBTI type (dropdown)
   - User manually enters Enneagram type (dropdown)
   - Optional: User provides self-description (500 char text box)
3. If self-description provided:
   - LLM generates 10-15 personality statements
   - User validates each: **👍 Agree** or **👎 Disagree** (binary, simple)
4. If no self-description:
   - LLM generates 10 generic statements based on types
   - User validates
5. User can immediately generate first artifact

**V1 Simplifications:**
- ❌ No ChatGPT import path (too complex, error-prone)
- ❌ No Big5 input (just MBTI + Enneagram)
- ❌ No conversational assessment (just manual entry)
- ❌ No "skip" option (everyone gets basic profile)
- ✅ Simple: Manual type entry + validate 10 statements = ready

**V2+: Add ChatGPT import, conversational assessment, Big5 sliders

### 4.3 Personality Profile Page (SIMPLIFIED for V1)

**Layout:**
- Top section: "Your Personality Summary"
  - MBTI distribution (e.g., "75% INTJ, 20% INTP, 5% ENTJ")
  - Enneagram distribution (e.g., "60% Type 5w4, 30% Type 1")
  - "Edit Types" button (re-run onboarding)

- Middle section: "Statements About You"
  - Simple list (no complex sorting/filtering for V1)
  - Each statement shows:
    - Statement text
    - Current state: 👍 Agreed | 👎 Disagreed | ⚪ Not validated
    - Actions: **👍 Agree** | **👎 Disagree** | **🗑️ Delete**

- Bottom section: "Add New Statement"
  - Text input (10-500 chars)
  - "Add Statement" button
  - "Generate 10 More Statements" button

**V1 Simplifications:**
- ❌ No precision indicators (defer to V2)
- ❌ No emphasis feature (defer to V2)
- ❌ No skip option (just don't validate)
- ❌ No inline editing (use delete + add)
- ❌ No uncertainty-based prioritization (just chronological order)
- ✅ Simple: Binary agree/disagree, clean UI

### 4.4 Artifact Generation Flow (SIMPLIFIED for V1)

1. User navigates to "Generate Artifact"
2. Selects artifact type from 5 predefined templates:
   - Workday Guide
   - Communication Style
   - Decision Framework
   - Conflict Resolution
   - Dating Profile Bio
3. System checks if artifact exists for this user + type:
   - If exists and profile not updated: Show cached artifact
   - If exists but profile updated recently: Show with "⚠️ Profile changed - consider regenerating"
   - If doesn't exist: Generate new
4. To generate:
   - Construct prompt from profile (MBTI + Enneagram distributions) + validated statements
   - Call LLM API (Claude Sonnet 4.5)
   - Save response as artifact (overwrites existing for this type)
   - Cache in Redis: `artifact:{userId}:{type}:latest`
   - Store in database
5. Display artifact to user with actions:
   - **Regenerate** button (overwrites existing)
   - **Delete** button
   - Copy to clipboard button

**V1 Simplifications:**
- ❌ No fingerprints or deviation detection (just check: profile.updatedAt > artifact.createdAt)
- ❌ No diff-aware prompting (always full regeneration)
- ❌ No custom prompts (5 predefined templates only)
- ❌ No share links (artifacts private only)
- ❌ No interactive editing (static markdown display)
- ✅ Simple: Generate → Cache → Show. Invalidate when profile changes.

### 4.5 Statement Generation (SIMPLIFIED for V1)

**Strategy:**
- **Initial onboarding:** 10-15 statements generated from user's types + optional description
- **After onboarding:** User can click "Generate 10 More Statements" button
- **No automatic generation:** User stays in control
- **Generation logic:** LLM generates based on:
  1. Current MBTI + Enneagram types
  2. Existing validated statements (avoid duplicates)
  3. Random categories to ensure diversity

**V1 Simplifications:**
- ❌ No information-theoretic prioritization (simple random generation)
- ❌ No smart prompts about profile completeness
- ❌ No contradiction detection
- ✅ Simple: Click button → get 10 statements → validate

### 4.6 Profile Management (SIMPLIFIED for V1)

**Profile Updates:**
- User can manually edit MBTI/Enneagram types via "Edit Types" button
- Statements are validated by user (agree/disagree)
- No automatic re-evaluation of types based on statements (too complex for V1)

**Deduplication:**
- No automated detection (user manually deletes duplicates if they notice)

**Versioning:**
- Single version per artifact type (regenerate overwrites)
- No history tracking

**V1 Simplifications:**
- ❌ No Big5 (just MBTI + Enneagram)
- ❌ No LLM-powered type re-evaluation
- ❌ No statement similarity detection
- ❌ No artifact version history
- ✅ Simple: User controls types, validates statements, generates artifacts

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

## 7. API Contracts & Request/Response Schemas (NEW)

### Standard Response Formats

```typescript
// Success response
interface SuccessResponse<T> {
  data: T;
}

// Error response
interface ErrorResponse {
  error: {
    code: string;           // "RATE_LIMIT_EXCEEDED", "INVALID_INPUT", etc.
    message: string;        // User-friendly message
    details?: any;          // Developer-friendly details
    retryAfter?: number;    // Seconds (for rate limits)
  }
}
```

### Artifact Generation (Critical Path)

```typescript
// POST /api/artifacts/generate
interface GenerateArtifactRequest {
  type: 'workday' | 'communication' | 'decision' | 'conflict' | 'dating';
}

interface GenerateArtifactResponse {
  id: string;
  type: string;
  title: string;
  content: string;          // Markdown
  generatedBy: string;      // "claude-sonnet-4.5"
  createdAt: string;        // ISO 8601
}

// Error codes:
// - RATE_LIMIT_EXCEEDED: Daily limit reached
// - LLM_API_FAILURE: Claude API error
// - INSUFFICIENT_PROFILE: Need more validated statements
```

### Statement Validation

```typescript
// PUT /api/statements/:id
interface UpdateStatementRequest {
  credence: -1 | 0 | 1;     // V1: Binary only
}

interface StatementResponse {
  id: string;
  statement: string;
  credence: number;
  userValidated: boolean;
  source: string;
  category?: string;
  createdAt: string;
}
```

### Profile Updates with Optimistic Locking

```typescript
// PUT /api/profile/mbti
interface UpdateMBTIRequest {
  distribution: Array<{
    type: MBTIType;
    probability: number;    // Must sum to 1.0
  }>;
  expectedVersion: number;  // For optimistic locking
}

interface UpdateMBTIResponse {
  version: number;          // Incremented version
  distribution: Array<{
    type: MBTIType;
    probability: number;
  }>;
}

// Error codes:
// - CONFLICT: Profile was updated by another request (version mismatch)
// - INVALID_DISTRIBUTION: Probabilities don't sum to 1.0
```

**Recommendation:** Use tRPC or OpenAPI to enforce type safety between frontend and backend.

## 8. API Endpoints (SIMPLIFIED for V1)

### Authentication
- `POST /api/auth/google` - Initiate Google OAuth
- `GET /api/auth/google/callback` - OAuth callback
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Profile
- `GET /api/profile` - Get current user's personality profile
- `PUT /api/profile/mbti` - Update MBTI distribution (with version check)
- `PUT /api/profile/enneagram` - Update Enneagram distribution (with version check)

### Statements (V1: Simplified)
- `GET /api/statements` - List all statements
- `POST /api/statements` - Create new statement
- `PUT /api/statements/:id` - Update statement credence (-1, 0, 1)
- `DELETE /api/statements/:id` - Delete statement
- `POST /api/statements/generate` - Generate 10 new statements via LLM

### Artifacts (V1: Simplified)
- `GET /api/artifacts` - List user's artifacts
- `GET /api/artifacts/:id` - Get specific artifact
- `POST /api/artifacts/generate` - Generate new artifact (predefined template only)
- `DELETE /api/artifacts/:id` - Delete artifact

**V1 Removals:**
- ❌ No `/share/:shareId` route (no sharing)
- ❌ No emphasis/skip endpoints (removed features)
- ❌ No Big5 endpoints (removed from V1)
- ❌ No regenerate-share-id (no sharing)
- ❌ No diff-aware regeneration (always full regeneration)

### Analytics
- `GET /api/usage/llm` - LLM cost tracking for user
- `GET /api/usage/summary` - Dashboard stats (artifact count, profile completeness)

## 8. Security & Privacy

### Authentication & Authorization (SIMPLIFIED for V1)
- All API endpoints require authentication (except auth endpoints)
- **Access tokens:** 15-minute expiration (HS256) - Industry standard for security
- **Refresh tokens:** 30-day expiration with rotation
- Refresh tokens stored in database (revocable)
- HttpOnly cookies for token storage (not localStorage)
- CSRF protection for state-changing operations
- CORS configuration for frontend domain only

**V1 Simplifications:**
- ✅ 15-min tokens (not 8hr) - Better security, seamless refresh via React Query
- ❌ No share links in V1 (all artifacts private)
- ❌ No multi-device session management UI (defer to V2)
- ❌ No user-agent/IP tracking in refresh_tokens table (defer to V2)

### Data Privacy & Deletion (SIMPLIFIED for V1)

**User Data Deletion:**
- **V1:** Hard delete immediately (no recovery window)
  1. User clicks "Delete Account"
  2. Show confirmation modal: "This cannot be undone"
  3. Delete user → Cascades to all data (profiles, statements, artifacts, refresh tokens)
  4. Clear Redis cache for user
  5. Anonymize LLM usage logs

```typescript
// Hard delete (V1: Simple)
async function deleteUser(userId: string): Promise<void> {
  // Database cascades handle all related data
  await db.users.delete({ where: { id: userId } });

  // Clear cache
  const cacheKeys = await redis.keys(`artifact:${userId}:*`);
  if (cacheKeys.length > 0) {
    await redis.del(...cacheKeys);
  }

  // Anonymize cost tracking (keep for analytics)
  await db.llm_usage.updateMany({
    where: { userId },
    data: { userId: 'DELETED_USER' }
  });
}
```

**Data Access:**
- Users can only access their own data
- No data sharing (no share links in V1)
- Encrypted environment variables for API keys
- GDPR compliance: Right to erasure honored immediately

**V1 Simplifications:**
- ❌ No soft delete (no deleted_at column, no recovery window, no cron jobs)
- ❌ No email notifications
- ✅ Simple: Click → Confirm → Delete. Done.

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

### 9.5 Cost Estimation & Budget Management (NEW - Critical Missing Piece)

**Per-User Cost Model:**

```typescript
// Onboarding (one-time)
const ONBOARDING_COST = {
  initialStatements: 15,      // 15 statements × ~500 tokens = 7,500 tokens
  costPerTokenInput: 0.000003,  // Claude Sonnet 4.5: $3/M input tokens
  costPerTokenOutput: 0.000015, // Claude Sonnet 4.5: $15/M output tokens
  totalOnboarding: 0.15         // ~$0.15 per user one-time
};

// Ongoing usage (per day)
const DAILY_COST_WORST_CASE = {
  artifactGeneration: 20,       // 20 artifacts/day (max limit)
  tokensPerArtifact: 2000,      // ~2K output tokens per artifact
  costPerArtifact: 0.05,        // ~$0.05 per artifact
  dailyArtifacts: 1.00,         // 20 × $0.05 = $1.00/day

  statementGeneration: 10,      // 10 batches/day (max limit)
  statementsPerBatch: 10,
  costPerBatch: 0.02,           // ~$0.02 per batch
  dailyStatements: 0.20,        // 10 × $0.02 = $0.20/day

  totalDailyWorstCase: 1.20     // $1.20/day if user maxes out limits
};

// Realistic average usage
const DAILY_COST_AVERAGE = {
  artifacts: 2,                 // 2 artifacts/day (realistic)
  statements: 1,                // 1 batch/day (realistic)
  totalDailyAverage: 0.12       // ~$0.12/day realistic
};

// Monthly projections
const MONTHLY_COST = {
  perUserWorstCase: 36.00,      // $1.20 × 30 days
  perUserAverage: 3.60,         // $0.12 × 30 days
  breakEvenRevenue: 5.00        // Need $5/user/month to be profitable
};

// Scale projections
const COST_AT_SCALE = {
  users100: {
    worstCase: 3600,            // $3,600/month if all users max out
    average: 360,               // $360/month realistic
    breakEven: 500              // Need $500/month revenue
  },
  users1000: {
    worstCase: 36000,           // $36,000/month
    average: 3600,              // $3,600/month realistic
    breakEven: 5000             // Need $5,000/month revenue
  }
};
```

**Budget Controls:**
- **Alert threshold:** $500/month - Send email notification
- **Hard cap:** $1,000/month - Temporarily disable new artifact generation, notify users
- **Per-user cost tracking:** Log all LLM usage in `llm_usage` table
- **Dashboard:** Show cost per user, total monthly cost, trending

**V1 Strategy:**
- Monitor costs daily
- No monetization (fully free)
- Hard budget cap at $1,000/month
- If costs exceed $500/month: Reduce daily limits from 20/10 to 10/5

**V2 Strategy (if costs are issue):**
- Freemium: 5 artifacts/month free, $5/month for 50 artifacts
- Usage-based: $0.10 per artifact above free tier
- Show users their cost in real-time

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
| Database | PostgreSQL | Normalized schema (not JSONB), robust, queryable |
| Cache | Redis | Fast, simple key-value for artifacts |
| Auth | Passport.js + Google OAuth | Easy integration, 15-min JWT tokens |
| LLM Provider | Claude API (primary) | High quality outputs, good for personality analysis |
| Testing | Vitest | Fast unit tests (<1s), ESM-native |
| Deployment | Railway.app | Easy deployment, managed PostgreSQL, cost-effective |

---

## SIMPLIFIED MVP SUMMARY (After Architecture Critique)

### 🎯 V1 Scope - Ship in 1 Week

**Core Loop:**
1. User signs in with Google
2. User enters MBTI + Enneagram types manually
3. LLM generates 10-15 personality statements
4. User validates statements (binary: 👍 agree / 👎 disagree)
5. User generates artifacts from 5 predefined templates
6. Artifacts cached, regenerated when profile changes

**What's In V1:**
- ✅ Google OAuth (15-min JWT tokens)
- ✅ MBTI + Enneagram (no Big5)
- ✅ Binary statement validation (no precision/emphasis)
- ✅ 5 predefined artifact templates
- ✅ Simple cache invalidation (no fingerprints)
- ✅ Hard delete (no soft delete)
- ✅ Normalized database schema
- ✅ Fast unit tests (<1s with Vitest)
- ✅ Cost tracking with hard budget cap ($1,000/month)

**What's Deferred to V2:**
- ❌ Big5 personality framework
- ❌ Precision/emphasis/skipped on statements
- ❌ Fingerprint-based smart caching
- ❌ Deviation detection
- ❌ ChatGPT import path
- ❌ Share links for artifacts
- ❌ Soft delete with recovery
- ❌ Custom artifact prompts
- ❌ Information-theoretic prioritization
- ❌ Diff-aware LLM prompting
- ❌ Multi-device session management

### 📊 Complexity Reduction

**Original Design:**
- 48 decisions, 10+ complex features
- Fingerprint-based caching with deviation detection
- 5-dimensional statement model (credence + precision + emphasis + skipped + validated)
- JSONB database schema
- 8-hour JWT tokens
- Soft delete with cron jobs
- ChatGPT integration
- Information-theoretic prioritization

**Simplified V1:**
- Focus on 15 core decisions
- Simple cache invalidation (profile.updatedAt > artifact.createdAt)
- 2-dimensional statement model (credence + validated)
- Normalized database schema (queryable!)
- 15-minute JWT tokens (industry standard)
- Hard delete (immediate)
- Manual entry only
- Random statement order

### 🚀 Expected Timeline

**V1 (1 week):**
- Day 1: Project setup, database schema, auth scaffolding
- Day 2-3: Profile models, statement CRUD, simple onboarding
- Day 4-5: LLM integration, artifact generation, caching
- Day 6: UI polish, error handling, testing
- Day 7: Deploy to Railway, test end-to-end

**V2 (After MVP validation - 2 weeks):**
- Add precision/emphasis features if users want them
- Add fingerprint-based caching if it's actually needed
- Add Big5 support if users request it
- Add share links if users want to share

### 💰 Cost Model

- **Per user onboarding:** $0.15 (one-time)
- **Average daily cost:** $0.12/user (2 artifacts + 1 statement batch)
- **Worst case daily:** $1.20/user (if maxing out 20/10 limits)
- **100 users:** ~$360/month (realistic) / $3,600/month (worst case)
- **Budget cap:** $1,000/month hard limit

### ✅ Success Criteria (V1)

**Ship if:**
- Users can sign in
- Users can validate 10+ statements
- Users can generate 5 artifact types
- Artifacts are personalized (different for different users)
- Page loads in <3s
- Artifact generation in <15s
- Unit tests pass in <1s

**Don't ship if:**
- Can't integrate Claude API reliably
- Database schema doesn't support probability distributions
- Cost exceeds $1,000/month in testing

### 📝 Next Steps (Implementation Order)

1. **Setup (Day 1):**
   - Initialize project with Vite + React + TypeScript
   - Setup Express backend with TypeScript
   - Create PostgreSQL schema (normalized tables)
   - Setup Railway deployment
   - Configure environment variables

2. **Auth (Day 1-2):**
   - Google OAuth integration
   - JWT token generation (15-min access, 30-day refresh)
   - Protected route middleware

3. **Profile & Statements (Day 2-3):**
   - Profile models (MBTI + Enneagram)
   - Statement CRUD endpoints
   - Simple onboarding: manual type entry + validate 10 statements

4. **LLM Integration (Day 4):**
   - Claude API integration
   - Statement generation (10 statements from types)
   - Cost tracking in database

5. **Artifacts (Day 5):**
   - 5 predefined templates
   - Artifact generation endpoint
   - Redis caching
   - Simple cache invalidation

6. **UI & Polish (Day 6):**
   - Profile page
   - Artifact gallery
   - Error handling
   - Loading states

7. **Testing & Deploy (Day 7):**
   - Unit tests for core logic
   - Deploy to Railway
   - End-to-end testing
   - Launch! 🚀

**Ship fast. Learn fast. Iterate fast.**
