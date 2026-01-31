import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';

// GET product history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const sql = getDb();
    const history = await sql`
      SELECT * FROM product_history
      WHERE product_id = ${id}
      ORDER BY created_at DESC
    `;
    return NextResponse.json(history);
  } catch (error) {
    console.error('Error fetching history:', error);
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}

// POST add history entry (for manual stock adjustments)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const sql = getDb();
    const body = await request.json();
    const { action, field_name, old_value, new_value, note } = body;

    const result = await sql`
      INSERT INTO product_history (product_id, action, field_name, old_value, new_value, note)
      VALUES (${id}, ${action}, ${field_name || null}, ${old_value || null}, ${new_value || null}, ${note || null})
      RETURNING *
    ` as Record<string, unknown>[];

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error('Error creating history:', error);
    return NextResponse.json({ error: 'Failed to create history' }, { status: 500 });
  }
}
