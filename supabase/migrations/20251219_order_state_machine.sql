-- Migration: Update orders table for order state machine
-- This migration adds new columns and stored procedures for order state machine

-- Step 1: Add new columns to orders table
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
  ADD COLUMN IF NOT EXISTS note TEXT;

-- Step 2: Update constraints for order_status (new states)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_order_status_check 
  CHECK (order_status IN ('pending_payment', 'paid', 'processing', 'completed', 'cancelled'));

-- Step 3: Add constraint for payment_status
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check 
  CHECK (payment_status IN ('unpaid', 'waiting_confirmation', 'paid', 'failed'));

-- Step 4: Update constraint for payment_method (cod and bank_transfer only)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check 
  CHECK (payment_method IN ('cod', 'bank_transfer'));

-- Step 5: Add stock column to products table if not exists
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INTEGER NOT NULL DEFAULT 0;

-- Step 6: Create function to create order with stock reduction (atomic)
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

-- Step 7: Create function to increment product stock (for cancellations)
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

-- Step 8: Create index for new columns
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON orders(order_status);

-- Step 9: Add comment to table
COMMENT ON TABLE orders IS 'Orders table with state machine implementation. State transitions are controlled by backend API only.';
COMMENT ON COLUMN orders.order_status IS 'Order status: pending_payment, paid, processing, completed, cancelled';
COMMENT ON COLUMN orders.payment_status IS 'Payment status: unpaid, waiting_confirmation, paid, failed';
COMMENT ON COLUMN orders.payment_method IS 'Payment method: cod, bank_transfer';
COMMENT ON COLUMN orders.payment_reference IS 'URL to payment proof image (for bank_transfer only)';
COMMENT ON COLUMN orders.cancel_reason IS 'Reason for order cancellation';
