-- Add constraints to product_images table for data integrity
-- Prevents race condition on primary image selection

-- Create unique partial index to ensure only one primary image per product
-- This prevents race conditions when multiple requests try to set is_primary=true
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_images_one_primary_per_product
ON product_images(product_id)
WHERE is_primary = true;

-- Add comment explaining the constraint
COMMENT ON INDEX idx_product_images_one_primary_per_product IS 
'Ensures only one primary image per product. Prevents race conditions during concurrent updates.';
