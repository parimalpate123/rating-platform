-- ─── Migration 001: Initial Schema ──────────────────────────────────────────
-- Core tables for the rating platform.
-- Each service owns its own tables (service prefix in comments).

-- ═══════════════════════════════════════════════════════════════════════════
-- product-config service tables
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS product_lines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(50) NOT NULL UNIQUE,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  status          VARCHAR(20) DEFAULT 'draft',
  product_owner   VARCHAR(255),
  technical_lead  VARCHAR(255),
  config          JSONB DEFAULT '{}',
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS systems (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(50) NOT NULL UNIQUE,
  name            VARCHAR(255) NOT NULL,
  type            VARCHAR(20) NOT NULL,          -- source | target | both
  format          VARCHAR(20) DEFAULT 'json',    -- json | xml | soap
  protocol        VARCHAR(20) DEFAULT 'rest',    -- rest | soap | grpc | mock
  base_url        VARCHAR(500),
  is_mock         BOOLEAN DEFAULT false,
  is_active       BOOLEAN DEFAULT true,
  config          JSONB DEFAULT '{}',
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mappings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(255) NOT NULL,
  product_line_code VARCHAR(50) REFERENCES product_lines(code),
  direction         VARCHAR(20) DEFAULT 'request',  -- request | response
  status            VARCHAR(20) DEFAULT 'draft',
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS field_mappings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mapping_id          UUID NOT NULL REFERENCES mappings(id) ON DELETE CASCADE,
  source_path         VARCHAR(500) NOT NULL,
  target_path         VARCHAR(500) NOT NULL,
  transformation_type VARCHAR(50) DEFAULT 'direct',
  transform_config    JSONB DEFAULT '{}',
  is_required         BOOLEAN DEFAULT false,
  default_value       VARCHAR(500),
  description         TEXT,
  sort_order          INT DEFAULT 0,
  created_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_scopes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_line_code VARCHAR(50) NOT NULL REFERENCES product_lines(code),
  scope_type        VARCHAR(30) NOT NULL,   -- state | coverage | transaction_type
  scope_value       VARCHAR(100) NOT NULL,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMP DEFAULT NOW(),
  UNIQUE(product_line_code, scope_type, scope_value)
);

CREATE TABLE IF NOT EXISTS lookup_tables (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(255) NOT NULL,
  product_line_code VARCHAR(50) REFERENCES product_lines(code),
  description       TEXT,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lookup_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lookup_table_id UUID NOT NULL REFERENCES lookup_tables(id) ON DELETE CASCADE,
  key             VARCHAR(255) NOT NULL,
  value           JSONB NOT NULL,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS decision_tables (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(255) NOT NULL,
  product_line_code VARCHAR(50) REFERENCES product_lines(code),
  description       TEXT,
  columns           JSONB DEFAULT '[]',
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS decision_table_rows (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_table_id UUID NOT NULL REFERENCES decision_tables(id) ON DELETE CASCADE,
  values            JSONB NOT NULL,
  sort_order        INT DEFAULT 0,
  created_at        TIMESTAMP DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- line-rating service tables (orchestrator definitions)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS product_orchestrators (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_line_code VARCHAR(50) NOT NULL UNIQUE REFERENCES product_lines(code),
  name              VARCHAR(255) NOT NULL,
  status            VARCHAR(20) DEFAULT 'draft',
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orchestrator_steps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orchestrator_id UUID NOT NULL REFERENCES product_orchestrators(id) ON DELETE CASCADE,
  step_order      INT NOT NULL,
  step_type       VARCHAR(50) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  config          JSONB DEFAULT '{}',
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE(orchestrator_id, step_order)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- rules-service tables
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS rules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(255) NOT NULL,
  product_line_code VARCHAR(50) NOT NULL REFERENCES product_lines(code),
  description       TEXT,
  priority          INT DEFAULT 0,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rule_conditions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id         UUID NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
  field           VARCHAR(255) NOT NULL,
  operator        VARCHAR(30) NOT NULL,
  value           JSONB,
  logical_group   INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rule_actions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id         UUID NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
  action_type     VARCHAR(30) NOT NULL,
  target_field    VARCHAR(255) NOT NULL,
  value           JSONB,
  sort_order      INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS entity_scope_tags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(30) NOT NULL,    -- rule | mapping
  entity_id   UUID NOT NULL,
  scope_type  VARCHAR(30) NOT NULL,
  scope_value VARCHAR(100) NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE(entity_type, entity_id, scope_type, scope_value)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- status-service tables
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id    VARCHAR(100) NOT NULL,
  product_line_code VARCHAR(50) NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'RECEIVED',
  request_payload   JSONB,
  response_payload  JSONB,
  scope             JSONB DEFAULT '{}',
  premium_result    DECIMAL(15, 2),
  error_message     TEXT,
  duration_ms       INT,
  step_count        INT DEFAULT 0,
  completed_steps   INT DEFAULT 0,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transaction_step_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id  UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  step_id         UUID,
  step_type       VARCHAR(50) NOT NULL,
  step_name       VARCHAR(255) NOT NULL,
  step_order      INT NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  input_snapshot  JSONB,
  output_snapshot JSONB,
  error_message   TEXT,
  duration_ms     INT,
  started_at      TIMESTAMP,
  completed_at    TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activity_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_line_code VARCHAR(50) NOT NULL,
  entity_type       VARCHAR(50) NOT NULL,
  entity_id         UUID,
  action            VARCHAR(50) NOT NULL,
  actor             VARCHAR(255),
  details           JSONB DEFAULT '{}',
  created_at        TIMESTAMP DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- Indexes
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_mappings_product ON mappings(product_line_code);
CREATE INDEX IF NOT EXISTS idx_field_mappings_mapping ON field_mappings(mapping_id);
CREATE INDEX IF NOT EXISTS idx_scopes_product ON product_scopes(product_line_code);
CREATE INDEX IF NOT EXISTS idx_orchestrator_product ON product_orchestrators(product_line_code);
CREATE INDEX IF NOT EXISTS idx_orchestrator_steps ON orchestrator_steps(orchestrator_id);
CREATE INDEX IF NOT EXISTS idx_rules_product ON rules(product_line_code);
CREATE INDEX IF NOT EXISTS idx_scope_tags_entity ON entity_scope_tags(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_transactions_product ON transactions(product_line_code);
CREATE INDEX IF NOT EXISTS idx_transactions_correlation ON transactions(correlation_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_step_logs_transaction ON transaction_step_logs(transaction_id);
CREATE INDEX IF NOT EXISTS idx_activity_product ON activity_log(product_line_code);
