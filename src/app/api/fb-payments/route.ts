import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';

// GET - fetch all payments
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sql = getDb();
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    let payments;

    if (startDate && endDate) {
      payments = await sql`
        SELECT * FROM fb_payments
        WHERE payment_date >= ${startDate} AND payment_date <= ${endDate}
        ORDER BY payment_date DESC
      `;
    } else {
      payments = await sql`
        SELECT * FROM fb_payments
        ORDER BY payment_date DESC
      `;
    }

    return NextResponse.json(payments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}

// POST - create new payment
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sql = getDb();
    const body = await request.json();
    const { payment_date, amount_usd, exchange_rate, description } = body;

    // Validation
    if (!payment_date || !amount_usd) {
      return NextResponse.json(
        { error: 'თარიღი და თანხა სავალდებულოა' },
        { status: 400 }
      );
    }

    if (amount_usd <= 0) {
      return NextResponse.json(
        { error: 'თანხა უნდა იყოს დადებითი რიცხვი' },
        { status: 400 }
      );
    }

    // Calculate GEL amount if exchange rate provided
    let amountGel = null;
    let usedExchangeRate = exchange_rate;

    if (exchange_rate && exchange_rate > 0) {
      amountGel = amount_usd * exchange_rate;
    } else {
      // Try to get exchange rate from database
      const rates = await sql`
        SELECT rate_to_gel FROM exchange_rates
        WHERE currency = 'USD' AND effective_date <= ${payment_date}
        ORDER BY effective_date DESC
        LIMIT 1
      ` as { rate_to_gel: number }[];

      if (rates.length > 0) {
        usedExchangeRate = Number(rates[0].rate_to_gel);
        amountGel = amount_usd * usedExchangeRate;
      }
    }

    const result = await sql`
      INSERT INTO fb_payments (payment_date, amount_usd, amount_gel, exchange_rate, description)
      VALUES (${payment_date}, ${amount_usd}, ${amountGel}, ${usedExchangeRate}, ${description || null})
      RETURNING *
    ` as Record<string, unknown>[];

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
  }
}
