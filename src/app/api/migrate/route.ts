import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// POST - run database migrations
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { setupKey } = body;

    if (setupKey !== process.env.SETUP_KEY) {
      return NextResponse.json({ error: 'Invalid setup key' }, { status: 403 });
    }

    const sql = getDb();

    // Add deleted_at column if it doesn't exist
    await sql`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL
    `;

    // Create product_history table
    await sql`
      CREATE TABLE IF NOT EXISTS product_history (
        id SERIAL PRIMARY KEY,
        product_id INTEGER NOT NULL REFERENCES products(id),
        action VARCHAR(50) NOT NULL,
        field_name VARCHAR(100),
        old_value TEXT,
        new_value TEXT,
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Add new order fields
    await sql`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS phone2 VARCHAR(20) DEFAULT NULL
    `;

    await sql`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS payment_type VARCHAR(20) DEFAULT 'cash'
    `;

    await sql`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS send_date DATE DEFAULT NULL
    `;

    // Add location column for Tbilisi/Region filtering
    await sql`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS location VARCHAR(20) DEFAULT 'tbilisi'
    `;

    // Add added_by column to track who added the order (default 'ani' for existing orders)
    await sql`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS added_by VARCHAR(50) DEFAULT 'ani'
    `;

    // Create exchange_rates table for USD/EUR to GEL conversion
    await sql`
      CREATE TABLE IF NOT EXISTS exchange_rates (
        id SERIAL PRIMARY KEY,
        currency VARCHAR(3) NOT NULL,
        rate_to_gel DECIMAL(10, 4) NOT NULL,
        effective_date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(currency, effective_date)
      )
    `;

    // Create fb_ad_spend table for daily ad spend synced from Facebook API
    await sql`
      CREATE TABLE IF NOT EXISTS fb_ad_spend (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        spend_usd DECIMAL(10, 2) NOT NULL,
        spend_gel DECIMAL(10, 2),
        exchange_rate DECIMAL(10, 4),
        impressions INTEGER DEFAULT 0,
        clicks INTEGER DEFAULT 0,
        campaign_id VARCHAR(100),
        campaign_name VARCHAR(255),
        synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(date, campaign_id)
      )
    `;

    // Create fb_payments table for manual payment entry
    await sql`
      CREATE TABLE IF NOT EXISTS fb_payments (
        id SERIAL PRIMARY KEY,
        payment_date DATE NOT NULL,
        amount_usd DECIMAL(10, 2) NOT NULL,
        amount_gel DECIMAL(10, 2),
        exchange_rate DECIMAL(10, 4),
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Add indexes for better query performance
    await sql`
      CREATE INDEX IF NOT EXISTS idx_fb_ad_spend_date ON fb_ad_spend(date)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_fb_payments_date ON fb_payments(payment_date)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_exchange_rates_date ON exchange_rates(effective_date)
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_orders_send_date ON orders(send_date)
    `;

    return NextResponse.json({ message: 'Migration completed successfully' }, { status: 200 });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 });
  }
}
