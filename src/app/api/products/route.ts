import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';

// Validation constants
const VALIDATION = {
  NAME_MIN: 2,
  NAME_MAX: 255,
  PRICE_MAX: 99999.99,
  QUANTITY_MAX: 99999,
  BARCODE_MAX: 50,
  DESCRIPTION_MAX: 2000,
};

// Validation helper functions
function validateProductInput(body: Record<string, unknown>): { valid: boolean; error?: string } {
  const { name, price, cost_price, quantity, barcode, description, photo_url } = body;

  // Name validation (required)
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'დასახელება სავალდებულოა' };
  }
  if (name.trim().length < VALIDATION.NAME_MIN) {
    return { valid: false, error: `დასახელება მინიმუმ ${VALIDATION.NAME_MIN} სიმბოლო` };
  }
  if (name.length > VALIDATION.NAME_MAX) {
    return { valid: false, error: `დასახელება მაქსიმუმ ${VALIDATION.NAME_MAX} სიმბოლო` };
  }

  // Price validation (required)
  if (price === undefined || price === null) {
    return { valid: false, error: 'ფასი სავალდებულოა' };
  }
  const priceNum = Number(price);
  if (isNaN(priceNum)) {
    return { valid: false, error: 'ფასი უნდა იყოს რიცხვი' };
  }
  if (priceNum < 0) {
    return { valid: false, error: 'ფასი არ შეიძლება იყოს უარყოფითი' };
  }
  if (priceNum > VALIDATION.PRICE_MAX) {
    return { valid: false, error: `ფასი მაქსიმუმ ${VALIDATION.PRICE_MAX}` };
  }

  // Cost price validation (optional)
  if (cost_price !== undefined && cost_price !== null && cost_price !== '') {
    const costNum = Number(cost_price);
    if (isNaN(costNum)) {
      return { valid: false, error: 'თვითღირებულება უნდა იყოს რიცხვი' };
    }
    if (costNum < 0) {
      return { valid: false, error: 'თვითღირებულება არ შეიძლება იყოს უარყოფითი' };
    }
    if (costNum > VALIDATION.PRICE_MAX) {
      return { valid: false, error: `თვითღირებულება მაქსიმუმ ${VALIDATION.PRICE_MAX}` };
    }
    if (costNum >= priceNum) {
      return { valid: false, error: 'თვითღირებულება უნდა იყოს ფასზე ნაკლები' };
    }
  }

  // Quantity validation (optional)
  if (quantity !== undefined && quantity !== null && quantity !== '') {
    const qtyNum = Number(quantity);
    if (isNaN(qtyNum) || !Number.isInteger(qtyNum)) {
      return { valid: false, error: 'რაოდენობა უნდა იყოს მთელი რიცხვი' };
    }
    if (qtyNum < 0) {
      return { valid: false, error: 'რაოდენობა არ შეიძლება იყოს უარყოფითი' };
    }
    if (qtyNum > VALIDATION.QUANTITY_MAX) {
      return { valid: false, error: `რაოდენობა მაქსიმუმ ${VALIDATION.QUANTITY_MAX}` };
    }
  }

  // Barcode validation (optional)
  if (barcode && typeof barcode === 'string' && barcode.length > VALIDATION.BARCODE_MAX) {
    return { valid: false, error: `შტრიხკოდი მაქსიმუმ ${VALIDATION.BARCODE_MAX} სიმბოლო` };
  }

  // Description validation (optional)
  if (description && typeof description === 'string' && description.length > VALIDATION.DESCRIPTION_MAX) {
    return { valid: false, error: `აღწერა მაქსიმუმ ${VALIDATION.DESCRIPTION_MAX} სიმბოლო` };
  }

  // Photo URL validation (optional)
  if (photo_url && typeof photo_url === 'string') {
    try {
      new URL(photo_url);
    } catch {
      return { valid: false, error: 'არასწორი URL ფორმატი' };
    }
  }

  return { valid: true };
}

// GET all products (excluding deleted) or deleted products with ?deleted=true
// Use ?all=true to get both active and deleted in a single response (for performance)
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sql = getDb();
    const { searchParams } = new URL(request.url);
    const showDeleted = searchParams.get('deleted') === 'true';
    const showAll = searchParams.get('all') === 'true';

    // Return both active and deleted products in a single response
    if (showAll) {
      const [activeProducts, deletedProducts] = await Promise.all([
        sql`
          SELECT * FROM products
          WHERE deleted_at IS NULL
          ORDER BY created_at DESC
        `,
        sql`
          SELECT * FROM products
          WHERE deleted_at IS NOT NULL
          ORDER BY deleted_at DESC
        `
      ]);
      return NextResponse.json({ active: activeProducts, deleted: deletedProducts });
    }

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

    // Validate input
    const validation = validateProductInput(body);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const result = await sql`
      INSERT INTO products (name, price, cost_price, quantity, description, barcode, photo_url)
      VALUES (${name}, ${price}, ${cost_price || null}, ${quantity || 0}, ${description || null}, ${barcode || null}, ${photo_url || null})
      RETURNING *
    ` as Record<string, unknown>[];

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
