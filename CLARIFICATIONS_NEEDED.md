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
