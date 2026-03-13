import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';

// PUT - update payment
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sql = getDb();
    const { id } = await params;
    const body = await request.json();
    const { payment_date, amount_usd, exchange_rate, description } = body;

    // Validation
    if (!payment_date || !amount_usd) {
      return NextResponse.json(
        { error: 'თარიღი და თანხა სავალდებულოა' },
        { status: 400 }
      );
    }

    // Calculate GEL amount
    const amountGel = exchange_rate ? amount_usd * exchange_rate : null;

    const result = await sql`
      UPDATE fb_payments
      SET payment_date = ${payment_date},
          amount_usd = ${amount_usd},
          amount_gel = ${amountGel},
          exchange_rate = ${exchange_rate || null},
          description = ${description || null}
      WHERE id = ${id}
      RETURNING *
    ` as Record<string, unknown>[];

    if (result.length === 0) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('Error updating payment:', error);
    return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 });
  }
}

// DELETE - remove payment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sql = getDb();
    const { id } = await params;

    await sql`DELETE FROM fb_payments WHERE id = ${id}`;

    return NextResponse.json({ message: 'Payment deleted' });
  } catch (error) {
    console.error('Error deleting payment:', error);
    return NextResponse.json({ error: 'Failed to delete payment' }, { status: 500 });
  }
}
