import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';

// Allowed order statuses
const VALID_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

// Validation constants
const VALIDATION = {
  NAME_MIN: 2,
  NAME_MAX: 255,
  PHONE_MIN: 9,
  PHONE_MAX: 15,
  ADDRESS_MIN: 5,
  ADDRESS_MAX: 500,
  COMMENT_MAX: 1000,
};

// Georgian phone pattern
const GEORGIAN_PHONE_REGEX = /^(\+995\s?)?5\d{8}$/;

// Validation helper for partial order updates
function validateOrderUpdate(body: Record<string, unknown>): { valid: boolean; error?: string } {
  const { fb_name, recipient_name, phone, address, comment, status } = body;

  // Status validation
  if (status !== undefined && !VALID_STATUSES.includes(status as string)) {
    return { valid: false, error: `არასწორი სტატუსი. დაშვებულია: ${VALID_STATUSES.join(', ')}` };
  }

  // FB name validation (if provided)
  if (fb_name !== undefined) {
    if (typeof fb_name !== 'string' || fb_name.trim().length < VALIDATION.NAME_MIN) {
      return { valid: false, error: `FB სახელი მინიმუმ ${VALIDATION.NAME_MIN} სიმბოლო` };
    }
    if (fb_name.length > VALIDATION.NAME_MAX) {
      return { valid: false, error: `FB სახელი მაქსიმუმ ${VALIDATION.NAME_MAX} სიმბოლო` };
    }
  }

  // Recipient name validation (if provided)
  if (recipient_name !== undefined) {
    if (typeof recipient_name !== 'string' || recipient_name.trim().length < VALIDATION.NAME_MIN) {
      return { valid: false, error: `ადრესატის სახელი მინიმუმ ${VALIDATION.NAME_MIN} სიმბოლო` };
    }
    if (recipient_name.length > VALIDATION.NAME_MAX) {
      return { valid: false, error: `ადრესატის სახელი მაქსიმუმ ${VALIDATION.NAME_MAX} სიმბოლო` };
    }
  }

  // Phone validation (if provided)
  if (phone !== undefined) {
    if (typeof phone !== 'string') {
      return { valid: false, error: 'ტელეფონი უნდა იყოს ტექსტი' };
    }
    const cleanPhone = phone.replace(/\s/g, '');
    if (cleanPhone.length < VALIDATION.PHONE_MIN) {
      return { valid: false, error: `ტელეფონი მინიმუმ ${VALIDATION.PHONE_MIN} ციფრი` };
    }
    if (cleanPhone.length > VALIDATION.PHONE_MAX) {
      return { valid: false, error: `ტელეფონი მაქსიმუმ ${VALIDATION.PHONE_MAX} სიმბოლო` };
    }
    if (!GEORGIAN_PHONE_REGEX.test(cleanPhone)) {
      return { valid: false, error: 'არასწორი ტელეფონის ფორმატი (მაგ: 5XXXXXXXX)' };
    }
  }

  // Address validation (if provided)
  if (address !== undefined) {
    if (typeof address !== 'string' || address.trim().length < VALIDATION.ADDRESS_MIN) {
      return { valid: false, error: `მისამართი მინიმუმ ${VALIDATION.ADDRESS_MIN} სიმბოლო` };
    }
    if (address.length > VALIDATION.ADDRESS_MAX) {
      return { valid: false, error: `მისამართი მაქსიმუმ ${VALIDATION.ADDRESS_MAX} სიმბოლო` };
    }
  }

  // Comment validation (if provided)
  if (comment !== undefined && comment !== null && typeof comment === 'string' && comment.length > VALIDATION.COMMENT_MAX) {
    return { valid: false, error: `კომენტარი მაქსიმუმ ${VALIDATION.COMMENT_MAX} სიმბოლო` };
  }

  return { valid: true };
}

// Helper function to restore stock for order items
async function restoreStockForOrder(sql: ReturnType<typeof getDb>, orderId: number, reason: string) {
  // Get order items
  const items = await sql`
    SELECT oi.product_id, oi.quantity, p.quantity as current_stock
    FROM order_items oi
    JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ${orderId}
  ` as Record<string, unknown>[];

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
        ${String(oldQuantity)},
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
    ` as Record<string, unknown>[];

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
    ` as Record<string, unknown>[];

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

    // Validate input
    const validation = validateOrderUpdate(body);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // If only status is being updated
    if (body.status !== undefined && Object.keys(body).length === 1) {
      // Get current order status
      const currentOrder = await sql`
        SELECT status FROM orders WHERE id = ${id}
      ` as Record<string, unknown>[];

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
        ` as Record<string, unknown>[];

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
              ${String(oldQuantity)},
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
      ` as Record<string, unknown>[];

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
    ` as Record<string, unknown>[];

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
    ` as Record<string, unknown>[];

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
