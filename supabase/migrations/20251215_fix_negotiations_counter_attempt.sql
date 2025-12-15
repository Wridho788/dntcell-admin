-- Fix negotiations table: Add counter_attempt field for proper tracking
-- Migration: 20251215_fix_negotiations_counter_attempt.sql

-- Add counter_attempt field to track number of counter offers
ALTER TABLE negotiations
ADD COLUMN IF NOT EXISTS counter_attempt INTEGER NOT NULL DEFAULT 0 CHECK (counter_attempt >= 0);

-- Add index for counter_attempt queries
CREATE INDEX IF NOT EXISTS idx_negotiations_counter_attempt ON negotiations(counter_attempt);

-- Add comment for documentation
COMMENT ON COLUMN negotiations.counter_attempt IS 'Number of counter offers made by admin. Increments each time admin counters.';

-- Update existing records: Set counter_attempt = 1 where counter_price exists
UPDATE negotiations
SET counter_attempt = 1
WHERE counter_price IS NOT NULL AND counter_attempt = 0;
