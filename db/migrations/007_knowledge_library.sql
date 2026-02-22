-- Migration 007: Knowledge Library
-- Adds document storage for AI-assisted rule generation and Q&A (RAG).
-- Also seeds the 3 standard AI prompt templates used across the platform.

-- ── Knowledge Library table ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS uploaded_files (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename      VARCHAR(255) NOT NULL,
  file_type     VARCHAR(20),
  file_size_bytes INT,
  storage_path  VARCHAR(500),
  s3_key        VARCHAR(500),
  s3_bucket     VARCHAR(255),
  product_line_code VARCHAR(50) REFERENCES product_lines(code) ON DELETE SET NULL,
  description   TEXT,
  tags          JSONB DEFAULT '[]',
  ai_status     VARCHAR(20) DEFAULT 'pending',   -- pending | processing | ready | error
  processing_error TEXT,
  extracted_text TEXT,
  chunk_count   INT DEFAULT 0,
  uploaded_by   VARCHAR(100),
  uploaded_at   TIMESTAMP DEFAULT NOW(),
  processed_at  TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_uploaded_files_product ON uploaded_files(product_line_code);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_status  ON uploaded_files(ai_status);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_s3_key  ON uploaded_files(s3_key);

-- Full-text search index on extracted text
CREATE INDEX IF NOT EXISTS idx_uploaded_files_fts
  ON uploaded_files USING gin(to_tsvector('english', COALESCE(extracted_text, '')));

-- ── Seed AI prompt templates ──────────────────────────────────────────────────
-- Idempotent — skips rows whose key already exists.

INSERT INTO ai_prompts (key, name, description, template, variables) VALUES
(
  'mapping-suggest-fields',
  'Mapping: Suggest Field Mappings',
  'Suggests 5-8 field mappings given a source/target system and existing mappings. Used in the Mapping Editor "Suggest Fields" button.',
  'You are an expert in insurance data integration.
Suggest field mappings for a {{sourceSystem}} → {{targetSystem}} integration for product line: {{productLine}}.
{{existingMappings}}
{{additionalContext}}

Suggest 5-8 additional field mappings that are typical for this integration.
Respond ONLY with JSON array:
[
  {
    "sourcePath": "$.Quote.Premium",
    "targetPath": "rating.basePremium",
    "transformationType": "direct",
    "confidence": 0.95,
    "reasoning": "Direct premium amount mapping"
  }
]
transformationType must be one of: direct, expression, lookup, conditional, static, concat, split, uppercase, lowercase, trim, number, date, custom

{{knowledge_context}}',
  '["sourceSystem","targetSystem","productLine","existingMappings","additionalContext","knowledge_context"]'
),
(
  'mapping-parse-text',
  'Mapping: Parse Text Requirements',
  'Parses free-form text or requirements into structured field mapping suggestions. Used in Mapping Create "AI-Powered" mode.',
  'You are an expert in insurance data integration. Parse the following requirements and extract field mapping definitions.
Source System: {{sourceSystem}}
Target System: {{targetSystem}}
Product Line: {{productLine}}

Requirements text:
{{requirementsText}}

{{knowledge_context}}

Extract all field mappings mentioned. For each, provide:
- sourcePath: JSONPath or field name from the source system (use $.FieldName format)
- targetPath: target field name or path
- transformationType: one of direct, expression, lookup, conditional, static, concat, split, uppercase, lowercase, trim, number, date, custom
- confidence: 0.0 to 1.0
- reasoning: brief explanation

Respond ONLY with a JSON array:
[
  {
    "sourcePath": "$.Quote.QuoteNumber",
    "targetPath": "policy.quoteId",
    "transformationType": "direct",
    "confidence": 0.95,
    "reasoning": "Direct mapping of quote number to policy ID"
  }
]',
  '["sourceSystem","targetSystem","productLine","requirementsText","knowledge_context"]'
),
(
  'rule-generate',
  'Rule: Generate from Description',
  'Converts a plain-English insurance rule description into structured rule JSON. Used in Rules → "Generate with AI" button.',
  'You are an expert in insurance business rules and rating systems.
Convert this plain-English description into a structured insurance rule JSON.

Product Line Code: {{productLine}}
Description: "{{description}}"

{{knowledge_context}}

Respond ONLY with valid JSON using this exact structure:
{
  "name": "Snake_Case_Rule_Name",
  "description": "one clear sentence describing the rule",
  "conditions": [
    { "fieldPath": "dot.path.field", "operator": "==", "value": "someValue" }
  ],
  "actions": [
    { "actionType": "surcharge", "targetField": "premium", "value": "0.05" }
  ],
  "confidence": 0.9
}

Rules:
- fieldPath uses dot notation (e.g. insured.state, building.yearBuilt, insured.annualRevenue, risk.claimCount)
- operator must be one of: ==, !=, >, >=, <, <=, contains, in, not_in, is_null, is_not_null
- actionType must be one of: surcharge, discount, multiply, set, add, subtract, reject
- value for surcharge/discount is a decimal (0.20 = 20%)
- for "in" operator, value is a comma-separated list: "CA,NY,NJ"
- multiple conditions are all ANDed together
- output only JSON, no explanation',
  '["productLine","description","knowledge_context"]'
)
ON CONFLICT (key) DO NOTHING;
