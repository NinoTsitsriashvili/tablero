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

    return NextResponse.json({ message: 'Migration completed successfully' }, { status: 200 });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 });
  }
}
