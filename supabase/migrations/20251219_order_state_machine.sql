-- Migration: Update orders table for order state machine
-- This migration adds new columns, order_status_logs table, and stored procedures

-- Step 1: Add new columns to orders table
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
  ADD COLUMN IF NOT EXISTS note TEXT,
  ADD COLUMN IF NOT EXISTS delivery_type TEXT;

-- Step 2: Update constraints for order_status (new states)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_order_status_check 
  CHECK (order_status IN ('pending', 'confirmed', 'processing', 'completed', 'cancelled'));

-- Step 3: Add constraint for payment_status
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check 
  CHECK (payment_status IN ('pending', 'paid', 'failed'));

-- Step 4: Update constraint for payment_method (cod and transfer only)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check 
  CHECK (payment_method IN ('cod', 'transfer'));

-- Step 5: Create order_status_logs table
CREATE TABLE IF NOT EXISTS order_status_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  changed_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT order_status_logs_from_status_check 
    CHECK (from_status IN ('pending', 'confirmed', 'processing', 'completed', 'cancelled')),
  CONSTRAINT order_status_logs_to_status_check 
    CHECK (to_status IN ('pending', 'confirmed', 'processing', 'completed', 'cancelled'))
);

-- Step 6: Create index for order_status_logs
CREATE INDEX IF NOT EXISTS idx_order_status_logs_order_id ON order_status_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_logs_created_at ON order_status_logs(created_at DESC);

-- Step 7: Add stock column to products table if not exists
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INTEGER NOT NULL DEFAULT 0;

-- Step 8: Create function to create order with stock reduction (atomic)
CREATE OR REPLACE FUNCTION create_order_with_stock_reduction(
  p_product_id UUID,
  p_buyer_id UUID,
  p_seller_id UUID,
  p_negotiation_id UUID,
  p_price INTEGER,
  p_payment_method TEXT,
  p_order_status TEXT,
  p_payment_status TEXT,
  p_shipping_address TEXT,
  p_note TEXT
) RETURNS SETOF orders AS $$
DECLARE
  v_order orders;
BEGIN
  -- Check stock and reduce atomically
  UPDATE products 
  SET stock = stock - 1
  WHERE id = p_product_id AND stock > 0;
  
  -- Check if update was successful
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product out of stock or not found';
  END IF;
  
  -- Create order
  INSERT INTO orders (
    product_id,
    buyer_id,
    seller_id,
    negotiation_id,
    price,
    payment_method,
    order_status,
    payment_status,
    shipping_address,
    note
  ) VALUES (
    p_product_id,
    p_buyer_id,
    p_seller_id,
    p_negotiation_id,
    p_price,
    p_payment_method,
    p_order_status,
    p_payment_status,
    p_shipping_address,
    p_note
  )
  RETURNING * INTO v_order;
  
  RETURN NEXT v_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 9: Create function to increment product stock (for cancellations)
CREATE OR REPLACE FUNCTION increment_product_stock(
  p_product_id UUID,
  p_quantity INTEGER DEFAULT 1
) RETURNS VOID AS $$
BEGIN
  UPDATE products 
  SET stock = stock + p_quantity
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 10: Create index for new columns
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON orders(order_status);

-- Step 11: Enable RLS for order_status_logs
ALTER TABLE order_status_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for order_status_logs
-- Admins can view all logs
CREATE POLICY "Admins can view all order status logs"
  ON order_status_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Admins can insert logs
CREATE POLICY "Admins can insert order status logs"
  ON order_status_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Step 12: Add comments to tables
COMMENT ON TABLE orders IS 'Orders table with state machine implementation. Admin controls all state transitions.';
COMMENT ON TABLE order_status_logs IS 'Log of all order status changes for audit trail.';
COMMENT ON COLUMN orders.order_status IS 'Order status: pending, confirmed, processing, completed, cancelled';
COMMENT ON COLUMN orders.payment_status IS 'Payment status: pending, paid, failed';
COMMENT ON COLUMN orders.payment_method IS 'Payment method: cod, transfer';
COMMENT ON COLUMN orders.payment_reference IS 'Reference or proof of payment';
COMMENT ON COLUMN orders.cancel_reason IS 'Reason for order cancellation';
COMMENT ON COLUMN orders.delivery_type IS 'Type of delivery (optional)';
