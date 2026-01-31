import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';

// GET orders for a specific product (via order_items)
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

    // Get orders that contain this product
    const orders = await sql`
      SELECT DISTINCT
        o.id,
        o.fb_name,
        o.recipient_name,
        o.phone,
        o.status,
        o.created_at,
        oi.quantity,
        oi.unit_price,
        oi.courier_price
      FROM orders o
      INNER JOIN order_items oi ON o.id = oi.order_id
      WHERE oi.product_id = ${id}
      ORDER BY o.created_at DESC
    ` as Record<string, unknown>[];

    // Calculate total price for each order item
    const ordersWithTotal = orders.map((order) => ({
      ...order,
      total_price: (Number(order.unit_price) * Number(order.quantity)) + Number(order.courier_price || 0),
    }));

    return NextResponse.json(ordersWithTotal);
  } catch (error) {
    console.error('Error fetching product orders:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}
