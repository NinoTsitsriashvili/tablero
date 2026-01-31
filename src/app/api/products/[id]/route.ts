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

// Validation helper function
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
    ` as Record<string, unknown>[];

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

    // Validate input
    const validation = validateProductInput(body);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Fetch old product to compare changes
    const oldProducts = await sql`
      SELECT * FROM products WHERE id = ${id} AND deleted_at IS NULL
    ` as Record<string, unknown>[];

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
    ` as Record<string, unknown>[];

    // Helper to normalize values for comparison
    const normalizeValue = (val: unknown, isNumeric: boolean): string | null => {
      if (val === null || val === undefined || val === '') return null;
      if (isNumeric) {
        const num = Number(val);
        return isNaN(num) ? null : num.toString();
      }
      return String(val).trim();
    };

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

    // Find which fields changed - use proper type-aware comparison
    const changedFields: string[] = [];
    const numericFields = ['price', 'cost_price', 'quantity'];

    // Compare name
    if (normalizeValue(oldProduct.name, false) !== normalizeValue(name, false)) {
      changedFields.push('name');
    }
    // Compare price
    if (normalizeValue(oldProduct.price, true) !== normalizeValue(price, true)) {
      changedFields.push('price');
    }
    // Compare cost_price
    if (normalizeValue(oldProduct.cost_price, true) !== normalizeValue(cost_price || null, true)) {
      changedFields.push('cost_price');
    }
    // Compare quantity
    if (normalizeValue(oldProduct.quantity, true) !== normalizeValue(quantity || 0, true)) {
      changedFields.push('quantity');
    }
    // Compare description
    if (normalizeValue(oldProduct.description, false) !== normalizeValue(description || null, false)) {
      changedFields.push('description');
    }
    // Compare barcode
    if (normalizeValue(oldProduct.barcode, false) !== normalizeValue(barcode || null, false)) {
      changedFields.push('barcode');
    }
    // Compare photo_url
    if (normalizeValue(oldProduct.photo_url, false) !== normalizeValue(photo_url || null, false)) {
      changedFields.push('photo_url');
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
    ` as Record<string, unknown>[];

    if (result.length === 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 });
  }
}
