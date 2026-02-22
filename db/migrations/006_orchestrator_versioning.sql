-- Add version tracking to product_orchestrators
-- Starts at 1 for all existing rows; incremented by application on each save.

ALTER TABLE product_orchestrators
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;
