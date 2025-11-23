-- Personality Profiling App - Database Schema (V1 MVP)
-- PostgreSQL Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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

-- Personality statements table (V1: Simplified - no precision, emphasized, skipped)
CREATE TABLE personality_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  statement TEXT NOT NULL CHECK (length(statement) <= 500 AND length(statement) >= 10),
  credence SMALLINT NOT NULL CHECK (credence IN (-1, 0, 1)),  -- Binary for V1: -1=disagree, 0=not validated, 1=agree
  category VARCHAR(50),
  source VARCHAR(50) NOT NULL CHECK (source IN ('llm_inferred', 'user_provided', 'questionnaire', 'chatgpt_import')),
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
  type VARCHAR(50) NOT NULL CHECK (type IN ('workday_guide', 'dating_profile', 'conflict_style', 'communication_guide', 'decision_framework')),
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  prompt TEXT NOT NULL,  -- Predefined template name for V1
  generated_by VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, type)  -- One artifact per type per user (overwrite on regenerate)
);

CREATE INDEX idx_artifacts_user_id ON artifacts(user_id);

-- Refresh tokens table (for JWT authentication)
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);

-- LLM usage tracking (for cost monitoring)
CREATE TABLE llm_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  operation VARCHAR(50) NOT NULL,  -- 'generate_statements', 'generate_artifact'
  model VARCHAR(50) NOT NULL,      -- 'claude-sonnet-4.5'
  tokens_input INTEGER NOT NULL,
  tokens_output INTEGER NOT NULL,
  cost_usd DECIMAL(10,6) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_llm_usage_user_id ON llm_usage(user_id);
CREATE INDEX idx_llm_usage_created_at ON llm_usage(created_at);
