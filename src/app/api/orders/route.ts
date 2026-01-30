import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';

// GET all orders with items
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sql = getDb();

    // Get all orders
    const orders = await sql`
      SELECT *
      FROM orders
      ORDER BY created_at DESC
    `;

    // Get all order items with product info
    const orderIds = orders.map((o) => o.id);

    if (orderIds.length === 0) {
      return NextResponse.json([]);
    }

    const items = await sql`
      SELECT
        oi.*,
        p.name as product_name,
        p.photo_url as product_photo_url
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ANY(${orderIds})
    `;

    // Calculate total for each order and attach items
    const ordersWithItems = orders.map((order) => {
      const orderItems = items.filter((i) => i.order_id === order.id);
      const total_price = orderItems.reduce((sum, item) => {
        return sum + (Number(item.unit_price) * Number(item.quantity)) + Number(item.courier_price || 0);
      }, 0);

      return {
        ...order,
        items: orderItems,
        total_price,
        // For backwards compatibility, use first item's product info
        product_name: orderItems[0]?.product_name || null,
        product_photo_url: orderItems[0]?.product_photo_url || null,
        items_count: orderItems.length,
      };
    });

    return NextResponse.json(ordersWithItems);
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

// POST create new order with items
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sql = getDb();
    const body = await request.json();
    const { fb_name, recipient_name, phone, address, comment, items } = body;

    if (!fb_name || !recipient_name || !phone || !address) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'At least one product is required' }, { status: 400 });
    }

    // Validate stock availability for all items
    for (const item of items) {
      const productResult = await sql`
        SELECT id, name, quantity FROM products WHERE id = ${item.product_id}
      `;

      if (productResult.length === 0) {
        return NextResponse.json({ error: `პროდუქტი ვერ მოიძებნა` }, { status: 400 });
      }

      const product = productResult[0];
      const requestedQty = item.quantity || 1;

      if (product.quantity < requestedQty) {
        return NextResponse.json({
          error: `არასაკმარისი მარაგი: ${product.name} (მარაგში: ${product.quantity}, მოთხოვნილი: ${requestedQty})`
        }, { status: 400 });
      }
    }

    // Create the order
    const orderResult = await sql`
      INSERT INTO orders (fb_name, recipient_name, phone, address, comment)
      VALUES (${fb_name}, ${recipient_name}, ${phone}, ${address}, ${comment || null})
      RETURNING *
    `;

    const order = orderResult[0];

    // Insert order items and reduce stock
    for (const item of items) {
      const quantity = item.quantity || 1;

      // Insert order item
      await sql`
        INSERT INTO order_items (order_id, product_id, quantity, unit_price, courier_price)
        VALUES (${order.id}, ${item.product_id}, ${quantity}, ${item.unit_price}, ${item.courier_price || 0})
      `;

      // Get current product quantity
      const productResult = await sql`
        SELECT quantity FROM products WHERE id = ${item.product_id}
      `;
      const oldQuantity = productResult[0].quantity;
      const newQuantity = oldQuantity - quantity;

      // Reduce product stock
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
          'stock_removed',
          'quantity',
          ${oldQuantity.toString()},
          ${newQuantity.toString()},
          ${'შეკვეთა #' + order.id + ' - გაყიდვა'}
        )
      `;
    }

    // Fetch the complete order with items
    const orderItems = await sql`
      SELECT
        oi.*,
        p.name as product_name,
        p.photo_url as product_photo_url
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ${order.id}
    `;

    const total_price = orderItems.reduce((sum, item) => {
      return sum + (Number(item.unit_price) * Number(item.quantity)) + Number(item.courier_price || 0);
    }, 0);

    return NextResponse.json(
      {
        ...order,
        items: orderItems,
        total_price,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}
