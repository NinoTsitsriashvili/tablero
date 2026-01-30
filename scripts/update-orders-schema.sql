-- Run this SQL in Neon Console to update orders for multiple products support

-- Step 1: Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10, 2) NOT NULL,
  courier_price DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- Step 2: Migrate existing order data to order_items
-- This will copy existing single-product orders to the new structure
INSERT INTO order_items (order_id, product_id, quantity, unit_price, courier_price)
SELECT id, product_id, 1, product_price, courier_price
FROM orders
WHERE product_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Step 3: Remove old product columns from orders table (optional - run after verifying migration)
-- Uncomment these lines after you've verified the migration worked correctly:
-- ALTER TABLE orders DROP COLUMN IF EXISTS product_id;
-- ALTER TABLE orders DROP COLUMN IF EXISTS product_price;
-- ALTER TABLE orders DROP COLUMN IF EXISTS courier_price;
-- ALTER TABLE orders DROP COLUMN IF EXISTS total_price;
