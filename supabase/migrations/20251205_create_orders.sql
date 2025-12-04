-- Create orders table for Sprint 4
-- Handles order tracking after successful negotiations

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id UUID, -- Admin UUID (no FK, since seller = admin)
  negotiation_id UUID REFERENCES negotiations(id) ON DELETE SET NULL,
  final_price INTEGER NOT NULL CHECK (final_price > 0),
  payment_method TEXT NOT NULL DEFAULT 'manual_transfer' CHECK (payment_method IN ('manual_transfer', 'cod')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed')),
  order_status TEXT NOT NULL DEFAULT 'pending' CHECK (order_status IN ('pending', 'processing', 'completed', 'cancelled')),
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_orders_product_id ON orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_negotiation_id ON orders(negotiation_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Policy: Buyers can view their own orders
CREATE POLICY "Buyers can view own orders"
  ON orders
  FOR SELECT
  TO authenticated
  USING (auth.uid() = buyer_id);

-- Policy: Admin can view all orders
CREATE POLICY "Admin can view all orders"
  ON orders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Policy: Admin can insert orders
CREATE POLICY "Admin can insert orders"
  ON orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Policy: Admin can update orders
CREATE POLICY "Admin can update orders"
  ON orders
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

-- Policy: Admin can delete orders
CREATE POLICY "Admin can delete orders"
  ON orders
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
CREATE OR REPLACE FUNCTION update_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_orders_updated_at();

-- Comment on table
COMMENT ON TABLE orders IS 'Tracks orders created after successful negotiations';
COMMENT ON COLUMN orders.seller_id IS 'Admin UUID - not a foreign key since seller = admin';
COMMENT ON COLUMN orders.payment_method IS 'manual_transfer: bank transfer, cod: cash on delivery';
COMMENT ON COLUMN orders.payment_status IS 'pending: awaiting payment, paid: payment received, failed: payment failed';
COMMENT ON COLUMN orders.order_status IS 'pending: order placed, processing: being processed, completed: fulfilled, cancelled: cancelled';
