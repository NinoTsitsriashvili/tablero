-- Run this SQL in Neon Console to create the orders table

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  fb_name VARCHAR(255) NOT NULL,
  recipient_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  address TEXT NOT NULL,
  product_id INTEGER REFERENCES products(id),
  product_price DECIMAL(10, 2) NOT NULL,
  courier_price DECIMAL(10, 2) DEFAULT 0,
  total_price DECIMAL(10, 2) GENERATED ALWAYS AS (product_price + courier_price) STORED,
  comment TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
