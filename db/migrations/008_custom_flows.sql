-- Custom Flows (line-rating): reusable sub-flows run as a single step in the main orchestrator

CREATE TABLE IF NOT EXISTS custom_flows (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(255) NOT NULL,
  description       TEXT,
  scope             VARCHAR(20) NOT NULL DEFAULT 'universal',
  product_line_code VARCHAR(50),
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS custom_flow_steps (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_flow_id UUID NOT NULL REFERENCES custom_flows(id) ON DELETE CASCADE,
  step_order   INT NOT NULL,
  step_type    VARCHAR(50) NOT NULL,
  name         VARCHAR(255) NOT NULL,
  config       JSONB DEFAULT '{}',
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMP DEFAULT NOW(),
  UNIQUE(custom_flow_id, step_order)
);

CREATE INDEX IF NOT EXISTS idx_custom_flow_steps_flow ON custom_flow_steps(custom_flow_id);
CREATE INDEX IF NOT EXISTS idx_custom_flows_scope_product ON custom_flows(scope, product_line_code);
