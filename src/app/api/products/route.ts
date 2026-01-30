import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';

// GET all products (excluding deleted) or deleted products with ?deleted=true
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sql = getDb();
    const { searchParams } = new URL(request.url);
    const showDeleted = searchParams.get('deleted') === 'true';

    if (showDeleted) {
      // Return only deleted products
      const products = await sql`
        SELECT * FROM products
        WHERE deleted_at IS NOT NULL
        ORDER BY deleted_at DESC
      `;
      return NextResponse.json(products);
    }

    // Return only active products
    const products = await sql`
      SELECT * FROM products
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC
    `;
    return NextResponse.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

// POST create new product
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sql = getDb();
    const body = await request.json();
    const { name, price, cost_price, quantity, description, barcode, photo_url } = body;

    if (!name || price === undefined) {
      return NextResponse.json({ error: 'Name and price are required' }, { status: 400 });
    }

    const result = await sql`
      INSERT INTO products (name, price, cost_price, quantity, description, barcode, photo_url)
      VALUES (${name}, ${price}, ${cost_price || null}, ${quantity || 0}, ${description || null}, ${barcode || null}, ${photo_url || null})
      RETURNING *
    `;

    const product = result[0];

    // Log creation in history with all fields as JSON snapshot
    const snapshot = JSON.stringify({
      name: name,
      price: price,
      cost_price: cost_price || null,
      quantity: quantity || 0,
      description: description || null,
      barcode: barcode || null,
      photo_url: photo_url || null,
    });

    await sql`
      INSERT INTO product_history (product_id, action, new_value)
      VALUES (${product.id}, 'created', ${snapshot})
    `;

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}
