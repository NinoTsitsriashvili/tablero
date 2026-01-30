import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';

// GET single product (only if not deleted)
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
    const products = await sql`
      SELECT * FROM products
      WHERE id = ${id} AND deleted_at IS NULL
    `;

    if (products.length === 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json(products[0]);
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
  }
}

// PUT update product
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
    const { name, price, cost_price, quantity, description, barcode, photo_url } = body;

    if (!name || price === undefined) {
      return NextResponse.json({ error: 'Name and price are required' }, { status: 400 });
    }

    // Fetch old product to compare changes
    const oldProducts = await sql`
      SELECT * FROM products WHERE id = ${id} AND deleted_at IS NULL
    `;

    if (oldProducts.length === 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const oldProduct = oldProducts[0];

    const result = await sql`
      UPDATE products
      SET name = ${name},
          price = ${price},
          cost_price = ${cost_price || null},
          quantity = ${quantity || 0},
          description = ${description || null},
          barcode = ${barcode || null},
          photo_url = ${photo_url || null},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id} AND deleted_at IS NULL
      RETURNING *
    `;

    // Log update with full snapshot showing old and new values, and which fields changed
    const oldSnapshot = {
      name: oldProduct.name,
      price: oldProduct.price,
      cost_price: oldProduct.cost_price,
      quantity: oldProduct.quantity,
      description: oldProduct.description,
      barcode: oldProduct.barcode,
      photo_url: oldProduct.photo_url,
    };

    const newSnapshot = {
      name: name,
      price: price,
      cost_price: cost_price || null,
      quantity: quantity || 0,
      description: description || null,
      barcode: barcode || null,
      photo_url: photo_url || null,
    };

    // Find which fields changed
    const changedFields: string[] = [];
    const fields = ['name', 'price', 'cost_price', 'quantity', 'description', 'barcode', 'photo_url'] as const;
    for (const field of fields) {
      const oldVal = oldSnapshot[field];
      const newVal = newSnapshot[field];
      const oldStr = oldVal === null ? null : String(oldVal);
      const newStr = newVal === null ? null : String(newVal);
      if (oldStr !== newStr) {
        changedFields.push(field);
      }
    }

    // Only log if something actually changed
    if (changedFields.length > 0) {
      await sql`
        INSERT INTO product_history (product_id, action, field_name, old_value, new_value)
        VALUES (${id}, 'updated', ${changedFields.join(',')}, ${JSON.stringify(oldSnapshot)}, ${JSON.stringify(newSnapshot)})
      `;
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

// DELETE product (soft delete - sets deleted_at timestamp)
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
      UPDATE products
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE id = ${id} AND deleted_at IS NULL
      RETURNING id
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}
