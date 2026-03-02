import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';

// Allowed order statuses
const VALID_STATUSES = ['pending', 'stickered', 'shipped', 'postponed', 'delivered', 'cancelled'];

// PATCH - update order status only
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const sql = getDb();
    const body = await request.json();
    const { status } = body;

    // Validate status
    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'არასწორი სტატუსი' }, { status: 400 });
    }

    // Check if order exists
    const existingOrder = await sql`
      SELECT id, status FROM orders WHERE id = ${id}
    ` as Record<string, unknown>[];

    if (existingOrder.length === 0) {
      return NextResponse.json({ error: 'შეკვეთა ვერ მოიძებნა' }, { status: 404 });
    }

    // Update order status
    const result = await sql`
      UPDATE orders
      SET status = ${status}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    ` as Record<string, unknown>[];

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error updating order status:', error);
    return NextResponse.json({ error: 'სტატუსის შეცვლა ვერ მოხერხდა' }, { status: 500 });
  }
}
