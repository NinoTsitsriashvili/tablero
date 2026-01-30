import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';

// GET single order with items
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

    // Get order
    const orders = await sql`
      SELECT *
      FROM orders
      WHERE id = ${id}
    `;

    if (orders.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const order = orders[0];

    // Get order items with product info
    const items = await sql`
      SELECT
        oi.*,
        p.name as product_name,
        p.photo_url as product_photo_url,
        p.barcode as product_barcode
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ${id}
    `;

    const total_price = items.reduce((sum, item) => {
      return sum + (Number(item.unit_price) * Number(item.quantity)) + Number(item.courier_price || 0);
    }, 0);

    return NextResponse.json({
      ...order,
      items,
      total_price,
      // For backwards compatibility
      product_name: items[0]?.product_name || null,
      product_photo_url: items[0]?.product_photo_url || null,
      product_id: items[0]?.product_id || null,
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
  }
}

// PUT update order (supports partial updates)
export async function PUT(
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

    // If only status is being updated
    if (body.status !== undefined && Object.keys(body).length === 1) {
      const result = await sql`
        UPDATE orders
        SET status = ${body.status},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
      `;

      if (result.length === 0) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      return NextResponse.json(result[0]);
    }

    // Full update (customer info only - items are managed separately)
    const { fb_name, recipient_name, phone, address, comment, status } = body;

    const result = await sql`
      UPDATE orders
      SET fb_name = ${fb_name},
          recipient_name = ${recipient_name},
          phone = ${phone},
          address = ${address},
          comment = ${comment || null},
          status = ${status || 'pending'},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error updating order:', error);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}

// DELETE order (cascades to order_items)
export async function DELETE(
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
    const result = await sql`
      DELETE FROM orders
      WHERE id = ${id}
      RETURNING id
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Order deleted successfully' });
  } catch (error) {
    console.error('Error deleting order:', error);
    return NextResponse.json({ error: 'Failed to delete order' }, { status: 500 });
  }
}
