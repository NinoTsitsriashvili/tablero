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

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- Step 2: Migrate existing order data to order_items (if any orders exist)
INSERT INTO order_items (order_id, product_id, quantity, unit_price, courier_price)
SELECT id, product_id, 1, product_price, courier_price
FROM orders
WHERE product_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM order_items WHERE order_items.order_id = orders.id);

-- Step 3: Make old product columns nullable so new orders can be created
ALTER TABLE orders ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE orders ALTER COLUMN product_price DROP NOT NULL;

-- Set default values for old columns (for backwards compatibility)
ALTER TABLE orders ALTER COLUMN product_price SET DEFAULT 0;
ALTER TABLE orders ALTER COLUMN courier_price SET DEFAULT 0;
