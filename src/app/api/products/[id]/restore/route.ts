import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';

// POST - restore a deleted product
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

    // Find the deleted product first
    const deletedProducts = await sql`
      SELECT * FROM products WHERE id = ${id} AND deleted_at IS NOT NULL
    `;

    if (deletedProducts.length === 0) {
      return NextResponse.json({ error: 'Deleted product not found' }, { status: 404 });
    }

    // Restore the product by setting deleted_at to NULL
    const result = await sql`
      UPDATE products
      SET deleted_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    // Log restore action in history
    await sql`
      INSERT INTO product_history (product_id, action, note)
      VALUES (${id}, 'restored', 'პროდუქტი აღდგენილია')
    `;

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error restoring product:', error);
    return NextResponse.json({ error: 'Failed to restore product' }, { status: 500 });
  }
}
