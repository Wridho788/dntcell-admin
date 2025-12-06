-- Update negotiations table for OneSignal integration
-- Add admin_id and final_price fields, update status to use approved instead of accepted

-- Add new columns
ALTER TABLE negotiations
ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS final_price INTEGER CHECK (final_price IS NULL OR final_price > 0),
ADD COLUMN IF NOT EXISTS note TEXT;

-- Update existing data: rename seller_id to admin_id context
-- If you have existing data, seller_id will be used as admin_id
UPDATE negotiations
SET admin_id = seller_id
WHERE seller_id IS NOT NULL AND admin_id IS NULL;

-- Create index for admin_id
CREATE INDEX IF NOT EXISTS idx_negotiations_admin_id ON negotiations(admin_id);

-- Update status check constraint to include 'approved' instead of 'accepted'
-- First, drop the existing constraint
ALTER TABLE negotiations DROP CONSTRAINT IF EXISTS negotiations_status_check;

-- Add new constraint with updated statuses
ALTER TABLE negotiations
ADD CONSTRAINT negotiations_status_check
CHECK (status IN ('pending', 'approved', 'rejected', 'countered'));

-- Update existing 'accepted' status to 'approved'
UPDATE negotiations
SET status = 'approved'
WHERE status = 'accepted';

-- Comment on new columns
COMMENT ON COLUMN negotiations.admin_id IS 'Admin user who approved/rejected the negotiation';
COMMENT ON COLUMN negotiations.final_price IS 'Final agreed price when status is approved';
COMMENT ON COLUMN negotiations.note IS 'Rejection note or admin comments';
