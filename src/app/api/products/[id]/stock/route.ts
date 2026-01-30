import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';

// POST - reduce stock quantity (for damaged goods, etc.)
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
    const { quantity, note } = body;

    // Validate quantity
    if (!quantity || quantity <= 0) {
      return NextResponse.json({ error: 'რაოდენობა უნდა იყოს დადებითი რიცხვი' }, { status: 400 });
    }

    // Find the product first
    const products = await sql`
      SELECT * FROM products WHERE id = ${id} AND deleted_at IS NULL
    `;

    if (products.length === 0) {
      return NextResponse.json({ error: 'პროდუქტი ვერ მოიძებნა' }, { status: 404 });
    }

    const product = products[0];
    const oldQuantity = Number(product.quantity);
    const reduceBy = Number(quantity);

    // Check if we have enough stock
    if (reduceBy > oldQuantity) {
      return NextResponse.json({
        error: `მარაგში მხოლოდ ${oldQuantity} ერთეულია. არ შეიძლება ${reduceBy}-ის ჩამოწერა`
      }, { status: 400 });
    }

    const newQuantity = oldQuantity - reduceBy;

    // Update the product quantity
    const result = await sql`
      UPDATE products
      SET quantity = ${newQuantity},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    // Log the stock reduction in history
    await sql`
      INSERT INTO product_history (product_id, action, field_name, old_value, new_value, note)
      VALUES (${id}, 'stock_removed', 'quantity', ${oldQuantity.toString()}, ${newQuantity.toString()}, ${note || null})
    `;

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error reducing stock:', error);
    return NextResponse.json({ error: 'მარაგის შემცირება ვერ მოხერხდა' }, { status: 500 });
  }
}
