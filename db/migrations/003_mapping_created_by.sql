-- Add created_by to mappings for audit trail
ALTER TABLE mappings
  ADD COLUMN IF NOT EXISTS created_by VARCHAR(100) DEFAULT 'System';
