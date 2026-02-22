-- Multi-flow orchestrator: allow multiple flows per product, each bound to an endpoint path
-- e.g. GL can have flows for 'rate', 'init-rate', 'renew'

ALTER TABLE product_orchestrators DROP CONSTRAINT IF EXISTS product_orchestrators_product_line_code_key;

ALTER TABLE product_orchestrators ADD COLUMN IF NOT EXISTS endpoint_path VARCHAR(50) NOT NULL DEFAULT 'rate';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_orch_product_endpoint'
  ) THEN
    ALTER TABLE product_orchestrators
      ADD CONSTRAINT uq_orch_product_endpoint UNIQUE(product_line_code, endpoint_path);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orch_product_endpoint ON product_orchestrators(product_line_code, endpoint_path);
