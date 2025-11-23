# Development Milestones

## Overview

This document outlines the phased development approach for the personality profiling app. The strategy is to build incrementally, starting with a minimal single-user version and progressively adding features.

**Philosophy:** Ship fast, iterate, and validate assumptions with real usage before building complex multi-user infrastructure.

---

## V1: Single-User MVP (2-3 weeks)

**Goal:** Validate core concept with a working single-user app (no authentication)

### Scope
- Single hardcoded user (no login, no auth, no multi-user)
- Basic personality profile storage (MBTI, Enneagram, Big5 with distributions + precision)
- Statement management (CRUD with credence + precision + emphasis)
- 2-3 predefined artifact templates
- Simple fingerprint-based caching
- ChatGPT prompt-based onboarding only

### Features Included
✅ **Profile Management**
- Manual entry of MBTI/Enneagram/Big5 types
- Statement CRUD (add, edit, delete, emphasize)
- Binary credence (👍/👎/❌) with precision slider
- Emphasis feature for core beliefs

✅ **Onboarding**
- "Get analysis from ChatGPT" path only (copy/paste)
- Parser for structured ChatGPT response
- Basic validation and profile initialization

✅ **Artifact Generation**
- 3 predefined templates:
  1. Ideal Workday Guide
  2. Communication Style Guide
  3. Decision-Making Framework
- Claude Sonnet 4.5 integration (LLM abstraction layer)
- Personality fingerprint stored with each artifact
- Deviation calculation and "regenerate" prompt
- Basic caching (profile hash → artifact content)

✅ **UI**
- Simple React SPA (no complex state management)
- Profile page with statement list
- Generate artifact page
- View artifact page with regenerate button
- Mobile-responsive (TailwindCSS)

### Features Deferred
❌ Multi-user support / authentication
❌ Manual entry, conversational assessment, skip onboarding paths
❌ Custom artifact prompts
❌ Background batch regeneration
❌ Shareable artifacts
❌ Advanced analytics
❌ Rate limiting / usage quotas

### Tech Stack (V1)
- **Frontend:** React + TypeScript + Vite + TailwindCSS
- **Backend:** Express + TypeScript + in-memory storage OR simple SQLite
- **LLM:** Claude Sonnet 4.5 (direct integration, abstraction layer ready)
- **Cache:** In-memory Map (or Redis if available)
- **Database:** SQLite (file-based, no server) OR JSON file + in-memory
- **Deployment:** Local development only

### Success Criteria
- [ ] Can create personality profile from ChatGPT analysis
- [ ] Can add/edit/delete/emphasize statements
- [ ] Can generate 3 types of artifacts
- [ ] Artifacts reflect current profile accurately
- [ ] Regeneration works when profile changes
- [ ] Mobile UI is usable
- [ ] Total dev time: 2-3 weeks

### Database Schema (V1)
```sql
-- SQLite schema for single user

CREATE TABLE personality_profiles (
  id INTEGER PRIMARY KEY,
  user_id TEXT DEFAULT 'default',  -- Always 'default' for single-user
  mbti_distribution TEXT NOT NULL,  -- JSON
  enneagram_distribution TEXT NOT NULL,
  big5_scores TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE personality_statements (
  id TEXT PRIMARY KEY,
  user_id TEXT DEFAULT 'default',
  statement TEXT NOT NULL,
  credence REAL NOT NULL CHECK (credence >= -1 AND credence <= 1),
  precision REAL DEFAULT 0.5 CHECK (precision >= 0 AND precision <= 1),
  emphasized INTEGER DEFAULT 0,  -- SQLite uses 0/1 for boolean
  category TEXT,
  source TEXT NOT NULL,
  user_validated INTEGER DEFAULT 0,
  skipped INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE artifacts (
  id TEXT PRIMARY KEY,
  user_id TEXT DEFAULT 'default',
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  prompt TEXT NOT NULL,
  personality_fingerprint TEXT NOT NULL,  -- JSON
  generated_by TEXT NOT NULL,
  deviation_score REAL DEFAULT 0,
  cached_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  view_count INTEGER DEFAULT 0,
  last_viewed_at DATETIME
);
```

### Migration Path to V2
- User table added with Google OAuth
- Replace `user_id='default'` with actual user IDs
- Move from SQLite to PostgreSQL
- Add multi-tenancy logic to all queries

---

## V2: Multi-User + Authentication (1-2 weeks)

**Goal:** Support multiple users with Google OAuth

### New Features
✅ **Authentication**
- Google OAuth integration (Passport.js)
- JWT access tokens (8hr) + refresh tokens (30 days)
- Session management
- Logout functionality

✅ **Multi-User Support**
- PostgreSQL database (replace SQLite)
- User isolation (all queries filtered by userId)
- User settings page
- Profile data belongs to specific user

✅ **Additional Onboarding Paths**
- Manual entry + self-description
- Conversational LLM assessment
- Skip for now (blank profile)

✅ **Infrastructure**
- Redis for caching artifacts
- Database migrations (Prisma or raw SQL)
- Environment-based configuration
- Docker Compose for local dev

### Database Changes
- Add `users` table with Google OAuth fields
- Add `refresh_tokens` table for session management
- Add foreign keys to all tables
- Add proper indexes for multi-user queries
- Move from SQLite to PostgreSQL

### Success Criteria
- [ ] Users can sign in with Google
- [ ] Each user has isolated data
- [ ] Session management works (access + refresh)
- [ ] Multiple users can use app simultaneously
- [ ] Migration from V1 to V2 preserves single-user data

---

## V3: Advanced Features (2-3 weeks)

**Goal:** Add features that improve retention and virality

### New Features
✅ **Shareable Artifacts**
- Unique opaque share IDs for artifacts
- Public `/share/{shareId}` route (no auth required)
- Privacy toggle per artifact
- View count tracking

✅ **Custom Artifact Prompts**
- Freeform text input for custom prompts
- Prompt injection protection
- Prompt templates library
- Save custom prompts as templates

✅ **Background Regeneration**
- Job queue for batch artifact updates
- User dashboard showing outdated artifacts
- "Update all" button queues regeneration jobs
- Email notification when regeneration completes

✅ **Statement Generation**
- "Generate more statements" button
- User-triggered statement generation from profile
- Context-aware generation based on artifact type
- Information-theoretic prioritization (review uncertain statements first)

✅ **Usage Analytics**
- User dashboard with stats
- LLM cost tracking per user
- Cache hit rate metrics
- Profile completeness indicator

### Success Criteria
- [ ] Users can share artifacts via link
- [ ] Custom prompts generate reasonable artifacts
- [ ] Background jobs process artifact regeneration
- [ ] Statement generation helps refine profiles
- [ ] Dashboard shows meaningful metrics

---

## V4: Polish & Scale (2-3 weeks)

**Goal:** Production-ready with monitoring and optimizations

### New Features
✅ **Rate Limiting & Quotas**
- Per-user daily limits (20 artifacts, 10 statements, 3 assessments)
- Global LLM budget monitoring
- Graceful limit messages
- Admin dashboard for quota management

✅ **Monitoring & Logging**
- Error tracking (Sentry or similar)
- Performance monitoring (API latency, DB queries)
- LLM cost dashboard
- Alert thresholds for critical metrics

✅ **Data Management**
- Soft delete for users (30-day recovery)
- Data export (GDPR compliance)
- Account deletion flow
- Statement deduplication warnings

✅ **UX Improvements**
- Skeleton screens for loading states
- Optimistic UI updates
- Better error messages with actions
- Onboarding tour for new users
- Keyboard shortcuts

✅ **Accessibility**
- WCAG 2.1 Level AA compliance
- Keyboard navigation
- Screen reader support
- Focus indicators
- Color contrast fixes

✅ **Deployment**
- Production deployment (Railway, Render, or AWS)
- Managed PostgreSQL (Supabase, Neon)
- Managed Redis (Upstash)
- CDN for static assets
- CI/CD pipeline (GitHub Actions)
- Automated backups
- SSL certificates

### Success Criteria
- [ ] App is deployed to production
- [ ] Monitoring dashboards are set up
- [ ] Rate limiting prevents abuse
- [ ] Basic accessibility compliance
- [ ] Automated backups configured
- [ ] CI/CD pipeline working

---

## Future Enhancements (Post-V4)

### High Value Features
- **Artifact versioning** - Track how artifacts evolve with profile
- **Statement import** - Parse from journaling apps, notes
- **Mobile native apps** - React Native for iOS/Android
- **Profile history timeline** - Visualize personality evolution over time
- **Email notifications** - Weekly insights, outdated artifacts
- **Collaborative profiles** - For couples, teams
- **API for third-party integrations** - Zapier, IFTTT
- **Advanced analytics** - Personality trends, correlation analysis

### Advanced LLM Features
- **Conversational artifact refinement** - Chat with LLM to improve artifacts
- **Multi-model comparison** - Generate same artifact with Claude vs GPT-5, compare
- **Personality insights** - LLM-generated weekly insights from profile changes
- **Statement suggestions** - LLM suggests statements to add based on gaps

### Scale & Performance
- **Profile caching layer** - Cache computed profiles in Redis
- **Artifact streaming** - Stream LLM responses to UI
- **Read replicas** - For database scaling
- **Horizontal scaling** - Multiple backend instances
- **Global CDN** - For international users

---

## Development Timeline Summary

| Milestone | Duration | Features | Database | Auth | Deployment |
|-----------|----------|----------|----------|------|------------|
| **V1** | 2-3 weeks | Core + single-user | SQLite | None | Local |
| **V2** | 1-2 weeks | Multi-user + OAuth | PostgreSQL | Google OAuth | Local |
| **V3** | 2-3 weeks | Sharing + custom + jobs | PostgreSQL | OAuth | Local/Staging |
| **V4** | 2-3 weeks | Monitoring + limits + polish | PostgreSQL | OAuth | Production |
| **Total** | 7-10 weeks | Full MVP | | | |

---

## Key Design Principles

1. **Start Simple:** V1 proves the concept without complexity
2. **Incremental:** Each version builds on previous, no rewrites
3. **Data-First:** Database schema designed for easy migration
4. **User-Centric:** Focus on core user value before infrastructure
5. **Cost-Conscious:** Validate before spending on managed services
6. **Ship Fast:** 2-3 week iterations with clear success criteria

---

## Migration Strategy: V1 → V2

When moving from single-user to multi-user:

```sql
-- 1. Add users table
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  google_id VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Insert default user for V1 data
INSERT INTO users (id, email, google_id, display_name)
VALUES ('00000000-0000-0000-0000-000000000000', 'default@localhost', 'default', 'Default User');

-- 3. Migrate V1 data (SQLite → PostgreSQL)
-- Export from SQLite, import to PostgreSQL with user_id = default UUID

-- 4. Add foreign keys
ALTER TABLE personality_profiles
  ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE personality_statements
  ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE artifacts
  ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 5. Future users get real UUIDs from Google OAuth
```

---

## Risk Mitigation

### Risk: V1 is too simple, doesn't validate concept
**Mitigation:** Include all core features (profile, statements, artifacts, regeneration). Only defer multi-user.

### Risk: Migration from SQLite to PostgreSQL is painful
**Mitigation:** Keep data models identical. Use ORMs (Prisma) to abstract database. Test migration early.

### Risk: LLM costs spiral out of control
**Mitigation:** Implement rate limiting in V2, monitor costs closely in V1.

### Risk: Fingerprint-based caching is too complex for V1
**Mitigation:** Use simple profile hash caching in V1, enhance in V2.

### Risk: Single-user V1 requires significant rework for multi-user
**Mitigation:** Design data models with `user_id` from the start (just hardcode 'default'). Use repository pattern to abstract user context.

---

## Success Metrics by Milestone

### V1 Metrics
- Can generate first artifact in < 5 minutes
- Can modify profile and see artifact change
- No critical bugs in core flows

### V2 Metrics
- 10+ users signed up
- Multi-user data isolation verified
- No auth/session bugs

### V3 Metrics
- 20% of users share at least one artifact
- Custom prompts used by 30% of users
- Background regeneration completes successfully

### V4 Metrics
- < 0.1% error rate
- Cache hit rate > 70%
- Average LLM cost per user < $3/month
- App loads in < 2 seconds
- Uptime > 99.5%
