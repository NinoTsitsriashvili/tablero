import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';

// GET all deleted products
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sql = getDb();
    const products = await sql`
      SELECT * FROM products
      WHERE deleted_at IS NOT NULL
      ORDER BY deleted_at DESC
    `;
    return NextResponse.json(products);
  } catch (error) {
    console.error('Error fetching deleted products:', error);
    return NextResponse.json({ error: 'Failed to fetch deleted products' }, { status: 500 });
  }
}
