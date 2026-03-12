-- Migration 010: Conditional branching support
-- Adds graph-based step wiring, branch decision logging, and execution path tracking.

-- Add next-step pointer for explicit graph wiring
ALTER TABLE orchestrator_steps
  ADD COLUMN IF NOT EXISTS default_next_step_id UUID REFERENCES orchestrator_steps(id) ON DELETE SET NULL;

ALTER TABLE custom_flow_steps
  ADD COLUMN IF NOT EXISTS default_next_step_id UUID REFERENCES custom_flow_steps(id) ON DELETE SET NULL;

-- Add branch decision logging to transaction step logs
ALTER TABLE transaction_step_logs
  ADD COLUMN IF NOT EXISTS branch_decision JSONB DEFAULT NULL;

-- Add execution path to transactions
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS execution_path TEXT[] DEFAULT NULL;
