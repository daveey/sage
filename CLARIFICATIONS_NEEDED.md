# Clarifications Needed

## Critical Decisions

### 1. Initial Personality Assessment
**Question:** How should users initially establish their personality profile?

**Options:**
- A. Full questionnaire (like 16personalities.com) - 60-100 questions
- B. Short questionnaire (10-15 questions) with lower confidence
- C. User manually selects their types (MBTI, Enneagram, Big5)
- D. LLM-driven conversational assessment
- E. Import from external services (e.g., upload existing test results)

**Current assumption:** Short questionnaire with option to refine later

---

### 2. Profile Update Mechanism
**Question:** How does the system update personality distributions when users agree/disagree with statements?

**Issues:**
- If user agrees with INTJ-style statements but was initially typed as ENFP, should MBTI distribution auto-update?
- Should there be a "lock" feature where users can lock in their types?
- How much weight does each statement carry in updating distributions?

**Current assumption:** Statements are informational only and don't automatically update type distributions, unless user explicitly requests a "re-evaluation"

---

### 3. Statement Generation Strategy
**Question:** When and how should new statements be generated?

**Options:**
- A. Generate 20-50 statements upfront, user validates over time
- B. Generate 5-10 statements per session, drip-feed
- C. User-triggered: "Generate more statements" button
- D. Automatic: Generate when user runs out of unvalidated statements
- E. Context-aware: Generate statements related to recent artifact requests

**Current assumption:** Generate 20 initial statements, then user can request more

---

### 4. Credence Granularity
**Question:** How fine-grained should the credence scale be?

**Options:**
- A. Binary: Agree/Disagree only (credence = 1 or -1)
- B. 3-point: Disagree/Neutral/Agree (-1, 0, 1)
- C. 5-point: Strongly Disagree to Strongly Agree (-1, -0.5, 0, 0.5, 1)
- D. 7-point or more fine-grained scale
- E. Slider: Continuous from -1 to 1

**Current assumption:** 5-point scale for balance of nuance and simplicity

---

### 5. Cache Invalidation Logic
**Question:** When should cached artifacts be invalidated?

**Scenarios:**
- User changes one minor statement credence
- User changes 5+ statement credences
- User updates MBTI type
- User adds new statements
- Time-based (30 days old)

**Current assumption:**
- Invalidate if >3 statements with credence >0.5 change
- Invalidate if personality type distributions change
- Invalidate after 30 days
- Show "Profile changed - Regenerate for updated version?" notice

---

### 6. LLM Provider Selection
**Question:** Which LLM should be primary and should users choose?

**Considerations:**
- Claude Sonnet 3.5: Better at nuanced personality analysis, more expensive
- GPT-4o: Faster, cheaper, good quality
- GPT-5 (when available): Unknown pricing/quality
- User choice: Let users pick per artifact?

**Trade-offs:**
- Cost: GPT-4o ~$5/million tokens vs Claude ~$15/million
- Quality: Subjective, depends on prompt
- Speed: GPT typically faster

**Current assumption:** Claude Sonnet as default, with option to switch to GPT for cost-conscious users

---

### 7. Artifact Versioning
**Question:** Should we keep version history of artifacts?

**Use cases:**
- User wants to see how "Ideal Workday" guide evolved as profile changed
- User wants to compare different versions
- Rollback to previous version

**Current assumption:** Single latest version only (MVP), add versioning later

---

### 8. Statement Privacy & Sharing
**Question:** Can users share their profiles or statements?

**Options:**
- A. Fully private (current assumption)
- B. Public profile option (with URL)
- C. Shareable artifacts only (not full profile)
- D. Team/group profiles (for work contexts)

**Current assumption:** Fully private, no sharing in MVP

---

### 9. Big5 Score Input
**Question:** How do users provide/update Big5 scores?

**Options:**
- A. Questionnaire-derived (requires 44-120 question OCEAN test)
- B. Self-assessment sliders (user estimates their own scores)
- C. LLM-inferred from MBTI + statements
- D. Optional field (not required for MVP)

**Current assumption:** LLM-inferred initially, user can manually adjust via sliders

---

### 10. Custom Artifact Prompts
**Question:** How much freedom should users have in custom prompts?

**Concerns:**
- Users might prompt for unrelated content
- Quality control for generated content
- Prompt injection risks

**Options:**
- A. Freeform text input (full freedom)
- B. Template with fill-in-blanks (e.g., "Create a guide for [work/relationship/health] focusing on [aspect]")
- C. Predefined templates only
- D. Hybrid: Predefined + custom with validation

**Current assumption:** Predefined templates for MVP, add custom prompts in v2

---

## Technical Clarifications

### 11. Authentication Session Management
**Question:** JWT tokens or server-side sessions?

**Options:**
- A. JWT tokens (stateless, scalable)
- B. Server-side sessions with Redis (more control, easier to revoke)

**Current assumption:** JWT with refresh tokens

---

### 12. Frontend State Management
**Question:** What state management solution?

**Options:**
- A. React Query only (server state) + useState/Context (UI state)
- B. Redux Toolkit
- C. Zustand
- D. Jotai/Recoil

**Current assumption:** React Query + Context (simpler for MVP)

---

### 13. Real-time Updates
**Question:** Should changes (statements, artifacts) update in real-time across devices?

**Current assumption:** No real-time for MVP, user refreshes to see updates

---

### 14. File Storage for Artifacts
**Question:** Should we support exporting artifacts as PDF/DOCX?

**Current assumption:** Markdown/HTML display only for MVP, add export later

---

### 15. Statement Deduplication
**Question:** How to handle similar/duplicate statements?

**Example:**
- "I prefer working alone" (credence 0.8)
- "I'm more productive in solitude" (credence 0.7)

**Options:**
- A. LLM checks for similarity before adding new statements
- B. User manually removes duplicates
- C. Show "similar statements" warning

**Current assumption:** No automated deduplication for MVP

---

## Business/Product Clarifications

### 16. Monetization Strategy
**Question:** Is this free or paid? Pricing model?

**Options:**
- A. Free tier: Limited artifacts per month (e.g., 5/month)
- B. Paid tier: Unlimited + advanced features
- C. Fully free (personal project)
- D. Usage-based pricing

**Current assumption:** Fully free for MVP, add pricing later if needed

---

### 17. Data Retention
**Question:** How long to keep inactive user data?

**Current assumption:** Keep indefinitely, provide manual delete option

---

### 18. Analytics & Telemetry
**Question:** What usage analytics to collect?

**Examples:**
- Page views
- Artifact generation counts
- Statement validation rates
- Profile completion rates

**Current assumption:** Basic analytics (PostgreSQL queries), no third-party analytics for MVP

---

### 19. Onboarding Flow
**Question:** What should new users see first?

**Options:**
- A. Immediate personality quiz
- B. Tour/tutorial of features
- C. Example profile walkthrough
- D. Direct to dashboard with prompts

**Current assumption:** Quick 5-question assessment, then tour

---

### 20. Error Handling for LLM Failures
**Question:** What happens if LLM API is down or rate-limited?

**Current assumption:**
- Show user-friendly error
- Retry with exponential backoff
- Queue requests if rate-limited
- Fallback: Show cached version with "may be outdated" warning

---

## UX/Design Clarifications

### 21. Statement Presentation Order
**Question:** How to order statements on profile page?

**Options:**
- A. Most recent first
- B. Highest credence first
- C. Category-grouped
- D. Randomized (to encourage review)
- E. User-customizable

**Current assumption:** Category-grouped, sorted by credence within category

---

### 22. Visual Design Style
**Question:** Design aesthetic and tone?

**Options:**
- A. Clinical/professional (like psychology assessment tools)
- B. Friendly/casual (like personality quizzes)
- C. Minimalist/modern (like Notion, Linear)
- D. Playful/gamified

**Current assumption:** Minimalist/modern with subtle personality touches

---

### 23. Mobile Interaction Pattern
**Question:** Best mobile UI for statement validation?

**Options:**
- A. Tinder-style swipe (left=disagree, right=agree)
- B. Tap to expand, then buttons
- C. Long-press for options
- D. Same as desktop (buttons below each statement)

**Current assumption:** Swipe for quick validation, tap to edit

---

### 24. Artifact Display Format
**Question:** How to present generated artifacts?

**Options:**
- A. Markdown rendered as HTML
- B. Rich text editor (allow user edits)
- C. PDF viewer
- D. Interactive format (e.g., checklist for workday guide)

**Current assumption:** Markdown rendered as HTML, read-only for MVP

---

### 25. Profile Completeness Indicator
**Question:** Should there be a "profile strength" metric?

**Current assumption:** Yes - show percentage based on:
- MBTI validated: 20%
- Enneagram validated: 20%
- Big5 scored: 20%
- Statements validated (at least 10): 40%

---

## Performance & Scaling

### 26. Expected User Scale
**Question:** How many users are we designing for?

**Implications:**
- Database sizing
- LLM API budget
- Caching strategy

**Current assumption:** 100-1000 users initially, design for 10K+

---

### 27. Artifact Generation Time
**Question:** What's acceptable wait time for artifact generation?

**Current assumption:**
- Show loading state
- 5-15 seconds acceptable
- Stream response if possible (for better UX)

---

## Priority Questions (Must Answer Before Development)

1. **Initial assessment approach** (#1)
2. **LLM provider and budget** (#6, #26)
3. **Credence granularity** (#4) - affects UI significantly
4. **Cache invalidation logic** (#5) - affects core functionality
5. **Custom prompts approach** (#10) - scope question

## Nice-to-Know (Can Decide During Development)

- Statement generation strategy (#3)
- Profile update mechanism (#2)
- Artifact versioning (#7)
- Mobile interaction patterns (#23)
- Big5 score input (#9)

## Can Defer to Post-MVP

- Sharing features (#8)
- Export formats (#14)
- Statement deduplication (#15)
- Monetization (#16)
- Real-time updates (#13)

---

## Additional Clarifications (From Design Critique)

### 28. Profile Hash Algorithm
**Question:** How should the profile hash be calculated for cache keys?

**Issues:**
- Should statement order matter?
- Include all statements or only validated ones with high credence?
- What threshold for "high credence"?
- How to handle statement text changes?

**Options:**
- A. Hash all statements sorted by ID (deterministic)
- B. Hash only statements with credence > 0.5
- C. Hash only top 20 statements by absolute credence value
- D. Include statement IDs and credence values, not full text

**Current assumption:** Include statements with credence > 0.5, sorted by ID, with ID:credence pairs

**Priority:** CRITICAL - affects caching behavior

---

### 29. Personality Distribution Normalization
**Question:** Should personality type distributions be required to sum to 1.0?

**Issues:**
- Current design allows any confidence values
- Could have MBTI distribution totaling 0.5 or 2.0
- Unclear how to interpret non-normalized distributions

**Options:**
- A. Enforce sum = 1.0 via application logic
- B. Enforce via database constraint
- C. Allow any values, normalize on display
- D. Use relative weights instead of probabilities

**Current assumption:** Enforce sum = 1.0 in application, validate before save

**Priority:** HIGH - affects data integrity

---

### 30. JWT Token Lifespan & Refresh
**Question:** What should JWT access and refresh token lifespans be?

**Security Considerations:**
- 24hr access token is long (stolen token valid all day)
- OAuth best practice: short-lived access, long-lived refresh

**Options:**
- A. Access: 24hr, No refresh (current assumption)
- B. Access: 1hr, Refresh: 7 days
- C. Access: 15min, Refresh: 30 days
- D. Access: 1hr, Refresh: 7 days with rotation

**Current assumption:** Access: 1hr, Refresh: 7 days with rotation

**Priority:** HIGH - affects security posture

---

### 31. Input Validation & Limits
**Question:** What are the limits for user-provided text?

**Needed Limits:**
- Statement text: ??? characters
- Custom artifact prompt: ??? characters
- Display name: ??? characters
- Number of statements per user: ???
- Number of artifacts per user: ???

**Options:**
- A. Statement: 500 chars, Prompt: 1000 chars, 200 statements max, 50 artifacts max
- B. Statement: 1000 chars, Prompt: 2000 chars, unlimited statements/artifacts
- C. Statement: 200 chars, Prompt: 500 chars, 100 statements max, 20 artifacts max

**Current assumption:** Statement: 500 chars, Prompt: 1000 chars, 500 statements max, 100 artifacts max

**Priority:** MEDIUM - affects storage and UX

---

### 32. LLM Cost Budget & Quotas
**Question:** What are the per-user and global LLM usage limits?

**Cost Context:**
- Avg artifact: ~$0.05 (Claude) or ~$0.02 (GPT-4)
- 100 users × 10 artifacts/month = $50-150/month
- Need protection against abuse

**Options:**
- A. Free tier: 5 artifacts/month, 3 statement generations/month
- B. Free tier: 10 artifacts/month, 5 statement generations/month, unlimited for MVP
- C. No limits for MVP (trust + monitor)
- D. Daily limits: 3 artifacts/day, 2 statement generations/day

**Current assumption:** Daily limits: 5 artifacts/day, 3 statement generations/day

**Priority:** HIGH - affects sustainability and abuse prevention

---

### 33. Soft Delete Strategy
**Question:** Should deletions be soft (recoverable) or hard (permanent)?

**Applies to:**
- User accounts
- Statements
- Artifacts
- Profiles

**Options:**
- A. All hard deletes (current assumption)
- B. Soft delete for users (30-day recovery), hard for others
- C. Soft delete for everything (30-day recovery)
- D. Soft delete for users and statements, hard for artifacts (can regenerate)

**Current assumption:** Soft delete for users (30 days), hard delete for statements/artifacts

**Priority:** MEDIUM - affects data recovery and GDPR compliance

---

### 34. Database Transaction Strategy
**Question:** Which operations should be wrapped in transactions?

**Candidates:**
- User creation + profile initialization + initial statements
- Artifact generation + caching + storage
- Batch statement updates
- Profile updates affecting multiple tables

**Options:**
- A. Use transactions for all multi-step operations
- B. Only for critical paths (user creation)
- C. No transactions, handle idempotency at API level
- D. Transactions + idempotency keys

**Current assumption:** Transactions for user creation and batch operations

**Priority:** MEDIUM - affects data consistency

---

### 35. LLM Response Validation
**Question:** How should we validate LLM-generated content before showing to users?

**Validation Checks:**
- Length (too short or too long?)
- Format (valid markdown?)
- Content moderation (inappropriate content?)
- Hallucination detection (false personality claims?)

**Options:**
- A. No validation (trust LLM)
- B. Basic checks: length, format validation
- C. Content moderation API (OpenAI Moderation)
- D. Full validation: length + format + moderation + retry on failure

**Current assumption:** Length + format validation, retry once on failure

**Priority:** MEDIUM - affects content quality and safety

---

### 36. Error Handling & User Feedback
**Question:** How should errors be communicated to users?

**Error Types:**
- LLM API failures
- Rate limit exceeded
- Invalid input
- Network errors
- Server errors

**Options:**
- A. Generic messages ("Something went wrong")
- B. Specific messages ("LLM API is currently unavailable, try again later")
- C. Actionable messages ("You've reached your daily limit. Upgrade to Pro or try again tomorrow.")
- D. Toast notifications with retry buttons

**Current assumption:** Specific messages with actionable suggestions, toast notifications

**Priority:** MEDIUM - affects UX

---

### 37. Monitoring & Alerting
**Question:** What metrics should be monitored and alerted on?

**Metrics to Track:**
- API response times (p50, p95, p99)
- Error rates by endpoint
- LLM API latency and errors
- Cache hit rate
- Database connection pool usage
- Active user sessions
- Cost per user

**Alerting Thresholds:**
- Error rate > 5%?
- API p95 > 2s?
- LLM cost > $X/day?

**Options:**
- A. No monitoring for MVP
- B. Basic logging only (review manually)
- C. Metrics collection + dashboards (Grafana)
- D. Full observability: metrics + logs + traces + alerts

**Current assumption:** Basic logging + simple metrics dashboard, no alerts for MVP

**Priority:** MEDIUM - can add post-launch

---

### 38. Database Backup & Recovery
**Question:** What's the backup and disaster recovery strategy?

**Questions:**
- How often to backup?
- How long to retain backups?
- Where to store backups?
- How to test restores?

**Options:**
- A. No backups for MVP (rely on managed DB provider)
- B. Daily automated backups, 30-day retention
- C. Continuous WAL archiving + daily snapshots
- D. Real-time replication to standby

**Current assumption:** Daily automated backups via managed DB provider, 30-day retention

**Priority:** MEDIUM - important for production

---

### 39. API Versioning Strategy
**Question:** Should the API be versioned from the start?

**Considerations:**
- Frontend and backend developed together for MVP
- May need to change API structure based on feedback
- Future mobile apps may need different API versions

**Options:**
- A. No versioning for MVP (tight coupling)
- B. Version in URL: `/api/v1/profile`
- C. Version in header: `Accept: application/vnd.app.v1+json`
- D. Version in URL, start with v1 even for MVP

**Current assumption:** No versioning for MVP, add when stabilizing for external clients

**Priority:** LOW - can add later

---

### 40. Accessibility (a11y) Requirements
**Question:** What accessibility level should we target?

**Standards:**
- WCAG 2.1 Level A (basic)
- WCAG 2.1 Level AA (recommended for most sites)
- WCAG 2.1 Level AAA (highest)

**Features:**
- Keyboard navigation
- Screen reader support
- Color contrast
- Focus indicators
- ARIA labels

**Options:**
- A. No specific a11y requirements for MVP
- B. Basic keyboard navigation + semantic HTML
- C. WCAG 2.1 Level AA compliance
- D. Full WCAG 2.1 Level AA + testing

**Current assumption:** Basic keyboard navigation + semantic HTML, improve toward AA post-MVP

**Priority:** MEDIUM - important for inclusivity

---

### 41. Loading States & Skeleton Screens
**Question:** How should loading states be implemented?

**Approaches:**
- Generic spinners
- Skeleton screens (fake content placeholders)
- Progress indicators for LLM generation
- Optimistic UI updates

**Options:**
- A. Simple spinners everywhere
- B. Skeleton screens for lists, spinners for actions
- C. Skeleton screens + progressive loading + optimistic updates
- D. Custom loading states per page

**Current assumption:** Skeleton screens for data fetching, progress indicators for LLM generation

**Priority:** MEDIUM - affects perceived performance

---

### 42. Email Notifications
**Question:** Should the app send any emails?

**Use Cases:**
- Welcome email
- Weekly personality insights digest
- "Your profile is incomplete" reminders
- New artifact types available
- Security alerts (new login, password change)

**Options:**
- A. No emails for MVP
- B. Transactional only (welcome, security alerts)
- C. Transactional + optional marketing (weekly digest)
- D. Full email system with preferences

**Current assumption:** No emails for MVP

**Priority:** LOW - can add later

---

### 43. Statement Weighting/Importance
**Question:** Should some statements carry more weight than others?

**Scenarios:**
- Core beliefs vs. preferences
- Recent statements vs. old ones
- User-provided vs. LLM-generated

**Options:**
- A. All statements equal weight (current assumption)
- B. User can mark statements as "important"
- C. Automatic weighting based on recency
- D. Weighting based on source (user-provided > questionnaire > LLM)

**Current assumption:** All statements equal weight, filter by credence threshold only

**Priority:** LOW - can add in later iterations

---

### 44. Profile Snapshot Versioning
**Question:** Should artifact profile snapshots reference a versioned profile or store full copy?

**Trade-offs:**
- **Full copy:** Redundant data, but artifact always reflects profile at generation time
- **Version reference:** Normalized, but requires profile version history table

**Options:**
- A. Store full profile snapshot in artifact (current design)
- B. Create `personality_profile_versions` table, store version ID in artifact
- C. Hybrid: Store version ID + diff from current profile

**Current assumption:** Store full snapshot for MVP, refactor to versioning post-MVP

**Priority:** LOW - optimization opportunity

---

### 45. Multi-device Session Management
**Question:** Can users be logged in on multiple devices simultaneously?

**Scenarios:**
- User on phone and desktop
- Multiple browser tabs
- Session revocation (logout all devices)

**Options:**
- A. Single session (logout on new login)
- B. Multiple sessions allowed, no management
- C. Multiple sessions with "Active Sessions" page showing all devices
- D. Multiple sessions + ability to revoke individual sessions

**Current assumption:** Multiple sessions allowed, no session management UI for MVP

**Priority:** LOW - can add later

---

### 46. Data Export & GDPR Compliance
**Question:** How can users export or delete their data?

**GDPR Requirements:**
- Right to access (download all data)
- Right to erasure (delete all data)
- Right to portability (machine-readable format)

**Options:**
- A. Manual request via email
- B. "Delete Account" button (cascading delete)
- C. "Download My Data" button (JSON export) + "Delete Account"
- D. Full data export + selective deletion + audit trail

**Current assumption:** "Delete Account" button for MVP, add data export post-MVP

**Priority:** MEDIUM - important for privacy compliance

---

### 47. Personality Framework Bias & Cultural Sensitivity
**Question:** How to handle the fact that MBTI/Enneagram are Western-centric?

**Issues:**
- MBTI criticized as pseudoscience
- Enneagram has spiritual origins
- Big5 more scientifically validated but still Western
- Cultural differences in personality expression

**Options:**
- A. Ignore, use frameworks as-is
- B. Add disclaimer about framework limitations
- C. Allow users to opt out of specific frameworks
- D. Research and add non-Western personality frameworks

**Current assumption:** Add disclaimer, acknowledge limitations, focus on user-validated statements as ground truth

**Priority:** LOW - philosophical concern

---

### 48. Artifact Regeneration Strategy
**Question:** When user clicks "Regenerate," should we invalidate cache or create new artifact?

**Options:**
- A. Invalidate cache, overwrite existing artifact
- B. Create new artifact version, keep old one
- C. Show diff between old and new, let user choose
- D. Always create new version, auto-delete old after confirmation

**Current assumption:** Invalidate cache, overwrite existing artifact

**Priority:** LOW - UX polish

---

## Updated Priority Questions

### Must Answer Before Development Starts
1. Initial assessment approach (#1)
2. LLM provider and budget (#6, #26, #32)
3. Credence granularity (#4)
4. Cache invalidation logic (#5, #28)
5. Profile hash algorithm (#28) ⚠️ NEW
6. JWT token strategy (#30) ⚠️ NEW
7. Input validation limits (#31) ⚠️ NEW
8. Personality distribution normalization (#29) ⚠️ NEW

### High Priority (Decide in First 2 Weeks)
9. Custom prompts approach (#10)
10. Statement generation strategy (#3)
11. LLM cost quotas (#32) ⚠️ NEW
12. Soft delete strategy (#33) ⚠️ NEW
13. LLM response validation (#35) ⚠️ NEW
14. Error handling approach (#36) ⚠️ NEW

### Medium Priority (Decide During Development)
15. Profile update mechanism (#2)
16. Artifact versioning (#7)
17. Database transaction strategy (#34) ⚠️ NEW
18. Monitoring approach (#37) ⚠️ NEW
19. Database backup (#38) ⚠️ NEW
20. Accessibility level (#40) ⚠️ NEW
21. Loading states (#41) ⚠️ NEW

### Low Priority (Can Decide Post-MVP)
22. Mobile interaction patterns (#23)
23. Big5 score input (#9)
24. Sharing features (#8)
25. Export formats (#14)
26. Statement deduplication (#15)
27. Monetization (#16)
28. Real-time updates (#13)
29. API versioning (#39) ⚠️ NEW
30. Email notifications (#42) ⚠️ NEW
31. Statement weighting (#43) ⚠️ NEW
32. Profile snapshot versioning (#44) ⚠️ NEW
33. Multi-device sessions (#45) ⚠️ NEW
34. GDPR export (#46) ⚠️ NEW
