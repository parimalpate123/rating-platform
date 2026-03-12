-- Migration 009: Add stable config keys to all configurable entities
-- These keys enable environment-agnostic config export/import (Config as Code).
-- Format: {domain}:{entity-type}:{slug} e.g. rating:rule:ny-building-surcharge

ALTER TABLE rules
  ADD COLUMN IF NOT EXISTS config_key TEXT UNIQUE;

ALTER TABLE mappings
  ADD COLUMN IF NOT EXISTS config_key TEXT UNIQUE;

ALTER TABLE product_orchestrators
  ADD COLUMN IF NOT EXISTS config_key TEXT UNIQUE;

ALTER TABLE orchestrator_steps
  ADD COLUMN IF NOT EXISTS config_key TEXT UNIQUE;

ALTER TABLE custom_flows
  ADD COLUMN IF NOT EXISTS config_key TEXT UNIQUE;

ALTER TABLE custom_flow_steps
  ADD COLUMN IF NOT EXISTS config_key TEXT UNIQUE;
