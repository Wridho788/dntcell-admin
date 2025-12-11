-- Migration: Add/Verify Foreign Keys for All Tables
-- Date: 2025-12-11
-- Purpose: Ensure all table relationships have proper foreign keys

-- negotiations table
ALTER TABLE negotiations 
  DROP CONSTRAINT IF EXISTS negotiations_product_id_fkey,
  ADD CONSTRAINT negotiations_product_id_fkey 
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

ALTER TABLE negotiations 
  DROP CONSTRAINT IF EXISTS negotiations_buyer_id_fkey,
  ADD CONSTRAINT negotiations_buyer_id_fkey 
    FOREIGN KEY (buyer_id) REFERENCES profiles(user_id) ON DELETE CASCADE;

-- products table
ALTER TABLE products 
  DROP CONSTRAINT IF EXISTS products_category_id_fkey,
  ADD CONSTRAINT products_category_id_fkey 
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;

ALTER TABLE products 
  DROP CONSTRAINT IF EXISTS products_seller_id_fkey,
  ADD CONSTRAINT products_seller_id_fkey 
    FOREIGN KEY (seller_id) REFERENCES profiles(user_id) ON DELETE CASCADE;

-- product_images table
ALTER TABLE product_images 
  DROP CONSTRAINT IF EXISTS product_images_product_id_fkey,
  ADD CONSTRAINT product_images_product_id_fkey 
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

-- orders table
ALTER TABLE orders 
  DROP CONSTRAINT IF EXISTS orders_product_id_fkey,
  ADD CONSTRAINT orders_product_id_fkey 
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;

ALTER TABLE orders 
  DROP CONSTRAINT IF EXISTS orders_negotiation_id_fkey,
  ADD CONSTRAINT orders_negotiation_id_fkey 
    FOREIGN KEY (negotiation_id) REFERENCES negotiations(id) ON DELETE SET NULL;

ALTER TABLE orders 
  DROP CONSTRAINT IF EXISTS orders_buyer_id_fkey,
  ADD CONSTRAINT orders_buyer_id_fkey 
    FOREIGN KEY (buyer_id) REFERENCES profiles(user_id) ON DELETE CASCADE;

ALTER TABLE orders 
  DROP CONSTRAINT IF EXISTS orders_seller_id_fkey,
  ADD CONSTRAINT orders_seller_id_fkey 
    FOREIGN KEY (seller_id) REFERENCES profiles(user_id) ON DELETE CASCADE;

-- notifications table
ALTER TABLE notifications 
  DROP CONSTRAINT IF EXISTS notifications_user_id_fkey,
  ADD CONSTRAINT notifications_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE;

-- profiles table
ALTER TABLE profiles 
  DROP CONSTRAINT IF EXISTS profiles_user_id_fkey,
  ADD CONSTRAINT profiles_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- activity_logs table
ALTER TABLE activity_logs 
  DROP CONSTRAINT IF EXISTS activity_logs_admin_id_fkey,
  ADD CONSTRAINT activity_logs_admin_id_fkey 
    FOREIGN KEY (admin_id) REFERENCES profiles(user_id) ON DELETE CASCADE;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- Verify foreign keys
SELECT
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;
