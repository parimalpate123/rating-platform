-- Migration 002: AI Prompts table for managing AI prompt templates
-- Used by the rules-service for AI-assisted rule generation

CREATE TABLE IF NOT EXISTS ai_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  template TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  kb_query_template VARCHAR(500),
  kb_top_k INT DEFAULT 3,
  version INT DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_prompts_key ON ai_prompts(key);

-- Add sort_order column to rule_actions if it doesn't exist
-- (the initial schema may use sort_order=0 default)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rule_actions' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE rule_actions ADD COLUMN sort_order INT DEFAULT 0;
  END IF;
END $$;
