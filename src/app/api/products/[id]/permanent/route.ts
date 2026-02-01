import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';

// DELETE - permanently delete a product (only if already soft-deleted)
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

    // First check if the product exists and is soft-deleted
    const deletedProducts = await sql`
      SELECT id FROM products WHERE id = ${id} AND deleted_at IS NOT NULL
    ` as Record<string, unknown>[];

    if (deletedProducts.length === 0) {
      return NextResponse.json({ error: 'Deleted product not found' }, { status: 404 });
    }

    // Delete product history first (foreign key constraint)
    await sql`
      DELETE FROM product_history WHERE product_id = ${id}
    `;

    // Permanently delete the product
    await sql`
      DELETE FROM products WHERE id = ${id}
    `;

    return NextResponse.json({ message: 'Product permanently deleted' });
  } catch (error) {
    console.error('Error permanently deleting product:', error);
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}
