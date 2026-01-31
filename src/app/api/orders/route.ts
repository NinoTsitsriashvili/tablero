import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';

// Validation constants
const VALIDATION = {
  NAME_MIN: 2,
  NAME_MAX: 255,
  PHONE_MIN: 9,
  PHONE_MAX: 15,
  ADDRESS_MIN: 5,
  ADDRESS_MAX: 500,
  COMMENT_MAX: 1000,
  QUANTITY_MAX: 999,
  COURIER_PRICE_MAX: 999.99,
};

// Georgian phone pattern: starts with 5 and has 9 digits, or with +995 prefix
const GEORGIAN_PHONE_REGEX = /^(\+995\s?)?5\d{8}$/;

// Allowed order statuses
const VALID_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

interface OrderItemInput {
  product_id: number;
  quantity?: number;
  unit_price: number;
  courier_price?: number;
}

// Validation helper function for order input
function validateOrderInput(body: Record<string, unknown>): { valid: boolean; error?: string } {
  const { fb_name, recipient_name, phone, address, comment, items } = body;

  // FB name validation (required)
  if (!fb_name || typeof fb_name !== 'string') {
    return { valid: false, error: 'FB სახელი სავალდებულოა' };
  }
  if (fb_name.trim().length < VALIDATION.NAME_MIN) {
    return { valid: false, error: `FB სახელი მინიმუმ ${VALIDATION.NAME_MIN} სიმბოლო` };
  }
  if (fb_name.length > VALIDATION.NAME_MAX) {
    return { valid: false, error: `FB სახელი მაქსიმუმ ${VALIDATION.NAME_MAX} სიმბოლო` };
  }

  // Recipient name validation (required)
  if (!recipient_name || typeof recipient_name !== 'string') {
    return { valid: false, error: 'ადრესატის სახელი სავალდებულოა' };
  }
  if (recipient_name.trim().length < VALIDATION.NAME_MIN) {
    return { valid: false, error: `ადრესატის სახელი მინიმუმ ${VALIDATION.NAME_MIN} სიმბოლო` };
  }
  if (recipient_name.length > VALIDATION.NAME_MAX) {
    return { valid: false, error: `ადრესატის სახელი მაქსიმუმ ${VALIDATION.NAME_MAX} სიმბოლო` };
  }

  // Phone validation (required)
  if (!phone || typeof phone !== 'string') {
    return { valid: false, error: 'ტელეფონი სავალდებულოა' };
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

  // Address validation (required)
  if (!address || typeof address !== 'string') {
    return { valid: false, error: 'მისამართი სავალდებულოა' };
  }
  if (address.trim().length < VALIDATION.ADDRESS_MIN) {
    return { valid: false, error: `მისამართი მინიმუმ ${VALIDATION.ADDRESS_MIN} სიმბოლო` };
  }
  if (address.length > VALIDATION.ADDRESS_MAX) {
    return { valid: false, error: `მისამართი მაქსიმუმ ${VALIDATION.ADDRESS_MAX} სიმბოლო` };
  }

  // Comment validation (optional)
  if (comment && typeof comment === 'string' && comment.length > VALIDATION.COMMENT_MAX) {
    return { valid: false, error: `კომენტარი მაქსიმუმ ${VALIDATION.COMMENT_MAX} სიმბოლო` };
  }

  // Items validation (required, at least 1)
  if (!items || !Array.isArray(items) || items.length === 0) {
    return { valid: false, error: 'დაამატეთ მინიმუმ ერთი პროდუქტი' };
  }

  // Check for duplicate products
  const productIds = (items as OrderItemInput[]).map((item) => item.product_id);
  const hasDuplicates = productIds.length !== new Set(productIds).size;
  if (hasDuplicates) {
    return { valid: false, error: 'ერთი პროდუქტი მხოლოდ ერთხელ შეიძლება დაემატოს' };
  }

  // Validate each item
  for (const item of items as OrderItemInput[]) {
    if (!item.product_id) {
      return { valid: false, error: 'პროდუქტის ID სავალდებულოა' };
    }

    const qty = item.quantity || 1;
    if (!Number.isInteger(qty) || qty < 1 || qty > VALIDATION.QUANTITY_MAX) {
      return { valid: false, error: `რაოდენობა უნდა იყოს 1-დან ${VALIDATION.QUANTITY_MAX}-მდე` };
    }

    if (item.unit_price === undefined || item.unit_price === null) {
      return { valid: false, error: 'პროდუქტის ფასი სავალდებულოა' };
    }
    if (isNaN(Number(item.unit_price)) || Number(item.unit_price) < 0) {
      return { valid: false, error: 'პროდუქტის ფასი უნდა იყოს დადებითი რიცხვი' };
    }

    if (item.courier_price !== undefined && item.courier_price !== null) {
      const courierNum = Number(item.courier_price);
      if (isNaN(courierNum) || courierNum < 0) {
        return { valid: false, error: 'კურიერის ფასი არ შეიძლება იყოს უარყოფითი' };
      }
      if (courierNum > VALIDATION.COURIER_PRICE_MAX) {
        return { valid: false, error: `კურიერის ფასი მაქსიმუმ ${VALIDATION.COURIER_PRICE_MAX}` };
      }
    }
  }

  return { valid: true };
}

// Export for use in [id]/route.ts
export { VALID_STATUSES };

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

    // Validate input
    const validation = validateOrderInput(body);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
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
