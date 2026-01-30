import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';

// Helper function to restore stock for order items
async function restoreStockForOrder(sql: ReturnType<typeof getDb>, orderId: number, reason: string) {
  // Get order items
  const items = await sql`
    SELECT oi.product_id, oi.quantity, p.quantity as current_stock
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ${orderId}
  `;

  // Restore stock for each item
  for (const item of items) {
    const oldQuantity = item.current_stock;
    const newQuantity = Number(oldQuantity) + Number(item.quantity);

    // Update product stock
    await sql`
      UPDATE products
      SET quantity = ${newQuantity}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${item.product_id}
    `;

    // Log to product history
    await sql`
      INSERT INTO product_history (product_id, action, field_name, old_value, new_value, note)
      VALUES (
        ${item.product_id},
        'stock_added',
        'quantity',
        ${oldQuantity.toString()},
        ${newQuantity.toString()},
        ${reason}
      )
    `;
  }
}

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
      // Get current order status
      const currentOrder = await sql`
        SELECT status FROM orders WHERE id = ${id}
      `;

      if (currentOrder.length === 0) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      const oldStatus = currentOrder[0].status;
      const newStatus = body.status;

      // If changing TO cancelled (and wasn't already cancelled), restore stock
      if (newStatus === 'cancelled' && oldStatus !== 'cancelled') {
        await restoreStockForOrder(sql, Number(id), `შეკვეთა #${id} - გაუქმება`);
      }

      // If changing FROM cancelled to something else, reduce stock again
      if (oldStatus === 'cancelled' && newStatus !== 'cancelled') {
        // Get order items
        const items = await sql`
          SELECT oi.product_id, oi.quantity, p.quantity as current_stock, p.name
          FROM order_items oi
          JOIN products p ON oi.product_id = p.id
          WHERE oi.order_id = ${id}
        `;

        // Check stock availability
        for (const item of items) {
          if (Number(item.current_stock) < Number(item.quantity)) {
            return NextResponse.json({
              error: `არასაკმარისი მარაგი: ${item.name} (მარაგში: ${item.current_stock}, საჭირო: ${item.quantity})`
            }, { status: 400 });
          }
        }

        // Reduce stock for each item
        for (const item of items) {
          const oldQuantity = item.current_stock;
          const newQuantity = Number(oldQuantity) - Number(item.quantity);

          await sql`
            UPDATE products
            SET quantity = ${newQuantity}, updated_at = CURRENT_TIMESTAMP
            WHERE id = ${item.product_id}
          `;

          await sql`
            INSERT INTO product_history (product_id, action, field_name, old_value, new_value, note)
            VALUES (
              ${item.product_id},
              'stock_removed',
              'quantity',
              ${oldQuantity.toString()},
              ${newQuantity.toString()},
              ${'შეკვეთა #' + id + ' - აღდგენა გაუქმებიდან'}
            )
          `;
        }
      }

      const result = await sql`
        UPDATE orders
        SET status = ${newStatus},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id}
        RETURNING *
      `;

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

// DELETE order - restores stock before deleting
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

    // Check if order exists and get its status
    const orderCheck = await sql`
      SELECT id, status FROM orders WHERE id = ${id}
    `;

    if (orderCheck.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Only restore stock if order wasn't already cancelled
    if (orderCheck[0].status !== 'cancelled') {
      await restoreStockForOrder(sql, Number(id), `შეკვეთა #${id} - წაშლა`);
    }

    // Delete order (order_items will cascade delete)
    await sql`
      DELETE FROM orders
      WHERE id = ${id}
    `;

    return NextResponse.json({ message: 'Order deleted successfully' });
  } catch (error) {
    console.error('Error deleting order:', error);
    return NextResponse.json({ error: 'Failed to delete order' }, { status: 500 });
  }
}
