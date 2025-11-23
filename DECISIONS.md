# Design Decisions

This document records all decisions made for the personality profiling app. Each decision references the corresponding question from CLARIFICATIONS_NEEDED.md.

**Status:** In Progress
**Last Updated:** 2025-11-23

---

## Critical Decisions (Must Answer Before Development)

### 1. Initial Personality Assessment ✅
**Question:** How should users initially establish their personality profile?

**Decision:** Multi-path onboarding with 4 options, ChatGPT archive analysis as recommended default

**Paths Offered:**
1. **"Analyze my conversations" (RECOMMENDED)** - Upload ChatGPT archive or paste conversations
2. **"I know my types"** - Manual entry + optional self-description
3. **"Take conversational assessment"** - LLM-driven adaptive Q&A (5-10 exchanges)
4. **"Skip for now"** - Start with blank profile, add statements manually

**Rationale:**
- ChatGPT archive analysis is unique differentiator
- Real conversational data > questionnaire responses (higher quality)
- Token budget allows generous LLM usage ($0.50-1.50 per analysis)
- Serves all user types: informed, new, exploratory, privacy-conscious
- Fast time-to-value: all paths reach first artifact in <10 minutes

**Implementation Notes:**
- Max upload size: 50MB for ChatGPT archives
- Privacy: Delete uploaded conversations immediately after analysis (keep only extracted profile)
- Analysis prompt: Extract MBTI/Enneagram/Big5 + 25-30 personality statements
- Conversational assessment: Adaptive LLM-driven Q&A (not traditional questionnaire)
- All paths can be revisited later from profile page
- Show privacy notice: "Conversations analyzed and deleted immediately"

**Cost Estimate:**
- Path 1 (Archive): ~$0.50-1.50 per user
- Path 2 (Manual): ~$0.10-0.30 per user (statement generation)
- Path 3 (Conversational): ~$0.30-0.60 per user
- Path 4 (Skip): $0
- Average: ~$0.50 per user onboarding (acceptable given no budget constraints)

---

### 2. LLM Provider and Budget
**Question:** Which LLM should be primary and what's the budget? (Related: #6, #26, #32)

**Decision:** [PENDING]

**Rationale:** [To be filled]

**Implementation Notes:** [To be filled]

---

### 3. Credence Granularity
**Question:** How fine-grained should the credence scale be? (#4)

**Decision:** [PENDING]

**Rationale:** [To be filled]

**Implementation Notes:** [To be filled]

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
