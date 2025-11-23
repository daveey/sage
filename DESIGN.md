# Personality Profiling App - Design Document

## 1. Overview

A web-based application that builds and maintains detailed personality profiles for users, then generates personalized artifacts (guides, templates, recommendations) based on those profiles.

### Core Value Proposition
Users receive highly personalized content by maintaining a living personality profile that combines established psychological frameworks (MBTI, Enneagram, Big5) with dynamic, user-validated statements about their preferences, behaviors, and traits.

### Design Decisions Status
This design incorporates **9 critical decisions** documented in DECISIONS.md:
1. ✅ Multi-path onboarding (ChatGPT prompt recommended)
2. ✅ Claude Sonnet 4.5 with LLM abstraction layer
3. ✅ Binary credence + precision + emphasis features
4. ✅ Fingerprint-based caching with deviation detection
5. ✅ Integrated profile hash algorithm
6. ✅ 8hr access / 30day refresh JWT tokens
7. ✅ Shareable artifacts with opaque links
8. ✅ Generous validation limits (500 char statements, 1000 artifacts max)
9. ✅ Probability distribution normalization

**See DECISIONS.md for detailed rationale and implementation notes.**
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

**Daily Limits (Abuse Prevention):**
- Artifact generation: 20/day per user
- Statement generation: 10/day per user
- Conversational assessment: 3/day per user
- No monthly caps (trust users, monitor usage)

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

### Data Privacy
- Users can only access their own data
- User can delete all data (GDPR compliance)
- No data sharing between users
- Encrypted environment variables for API keys

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

## 9. Deployment Strategy (Railway.app)

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

## 10. Future Enhancements (Out of Scope for MVP)

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
