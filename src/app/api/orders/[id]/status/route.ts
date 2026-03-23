import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';

// Allowed order statuses
const VALID_STATUSES = ['pending', 'stickered', 'shipped', 'postponed'];

// Helper function to restore stock for order items (when order is cancelled)
async function restoreStockForOrder(sql: ReturnType<typeof getDb>, orderId: number, reason: string) {
  const items = await sql`
    SELECT oi.product_id, oi.quantity, p.quantity as current_stock
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ${orderId}
  ` as Record<string, unknown>[];

  for (const item of items) {
    const oldQuantity = Number(item.current_stock);
    const newQuantity = oldQuantity + Number(item.quantity);

    await sql`
      UPDATE products
      SET quantity = ${newQuantity}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${item.product_id}
    `;

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
    const { status: newStatus } = body;

    // Validate status
    if (!newStatus || !VALID_STATUSES.includes(newStatus)) {
      return NextResponse.json({ error: 'არასწორი სტატუსი' }, { status: 400 });
    }

    // Check if order exists and get current status
    const existingOrder = await sql`
      SELECT id, status FROM orders WHERE id = ${id}
    ` as Record<string, unknown>[];

    if (existingOrder.length === 0) {
      return NextResponse.json({ error: 'შეკვეთა ვერ მოიძებნა' }, { status: 404 });
    }

    const oldStatus = existingOrder[0].status as string;

    // Handle stock management based on status change
    // Case 1: Changing TO cancelled (and wasn't already cancelled) - restore stock
    if (newStatus === 'cancelled' && oldStatus !== 'cancelled') {
      await restoreStockForOrder(sql, Number(id), `შეკვეთა #${id} - გაუქმება`);
    }

    // Case 2: Changing FROM cancelled to something else - reduce stock again
    if (oldStatus === 'cancelled' && newStatus !== 'cancelled') {
      // Get order items with current stock
      const items = await sql`
        SELECT oi.product_id, oi.quantity, p.quantity as current_stock, p.name
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ${id}
      ` as Record<string, unknown>[];

      // Check stock availability first
      for (const item of items) {
        if (Number(item.current_stock) < Number(item.quantity)) {
          return NextResponse.json({
            error: `არასაკმარისი მარაგი: ${item.name} (მარაგში: ${item.current_stock}, საჭირო: ${item.quantity})`
          }, { status: 400 });
        }
      }

      // Reduce stock for each item
      for (const item of items) {
        const oldQuantity = Number(item.current_stock);
        const newQuantity = oldQuantity - Number(item.quantity);

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

    // Update order status
    const result = await sql`
      UPDATE orders
      SET status = ${newStatus}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    ` as Record<string, unknown>[];

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error updating order status:', error);
    return NextResponse.json({ error: 'სტატუსის შეცვლა ვერ მოხერხდა' }, { status: 500 });
  }
}
