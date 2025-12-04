-- Create negotiations table for Sprint 3
-- Handles price negotiations between buyers (users) and admin (seller)

CREATE TABLE IF NOT EXISTS negotiations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id UUID, -- Admin UUID (no FK, since seller = admin)
  offer_price INTEGER NOT NULL CHECK (offer_price > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'countered')),
  counter_price INTEGER CHECK (counter_price IS NULL OR counter_price > 0),
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_negotiations_product_id ON negotiations(product_id);
CREATE INDEX IF NOT EXISTS idx_negotiations_buyer_id ON negotiations(buyer_id);
CREATE INDEX IF NOT EXISTS idx_negotiations_status ON negotiations(status);
CREATE INDEX IF NOT EXISTS idx_negotiations_created_at ON negotiations(created_at DESC);

-- Enable RLS
ALTER TABLE negotiations ENABLE ROW LEVEL SECURITY;

-- Policy: Buyers can INSERT their own negotiations
CREATE POLICY "Buyers can create negotiations"
  ON negotiations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = buyer_id);

-- Policy: Buyers can view their own negotiations
CREATE POLICY "Buyers can view own negotiations"
  ON negotiations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = buyer_id);

-- Policy: Admin can view all negotiations
CREATE POLICY "Admin can view all negotiations"
  ON negotiations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Policy: Admin can update negotiations (accept/reject/counter)
CREATE POLICY "Admin can update negotiations"
  ON negotiations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Policy: Admin can delete negotiations
CREATE POLICY "Admin can delete negotiations"
  ON negotiations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_negotiations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_negotiations_updated_at
  BEFORE UPDATE ON negotiations
  FOR EACH ROW
  EXECUTE FUNCTION update_negotiations_updated_at();

-- Comment on table
COMMENT ON TABLE negotiations IS 'Stores price negotiation offers between buyers and admin for products';
COMMENT ON COLUMN negotiations.seller_id IS 'Admin UUID - not a foreign key since seller = admin';
COMMENT ON COLUMN negotiations.status IS 'pending: waiting for admin response, accepted: admin accepted offer, rejected: admin rejected, countered: admin made counter-offer';
COMMENT ON COLUMN negotiations.counter_price IS 'Admin counter-offer price (only set when status = countered)';
