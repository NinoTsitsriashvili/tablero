import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';

// GET - fetch all exchange rates
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sql = getDb();
    const { searchParams } = new URL(request.url);
    const currency = searchParams.get('currency');
    const date = searchParams.get('date');

    let rates;

    if (date && currency) {
      // Get specific rate for date and currency
      rates = await sql`
        SELECT * FROM exchange_rates
        WHERE currency = ${currency} AND effective_date <= ${date}
        ORDER BY effective_date DESC
        LIMIT 1
      `;
    } else if (currency) {
      // Get all rates for a currency
      rates = await sql`
        SELECT * FROM exchange_rates
        WHERE currency = ${currency}
        ORDER BY effective_date DESC
      `;
    } else {
      // Get all rates
      rates = await sql`
        SELECT * FROM exchange_rates
        ORDER BY effective_date DESC, currency
      `;
    }

    return NextResponse.json(rates);
  } catch (error) {
    console.error('Error fetching exchange rates:', error);
    return NextResponse.json({ error: 'Failed to fetch exchange rates' }, { status: 500 });
  }
}

// POST - create new exchange rate
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sql = getDb();
    const body = await request.json();
    const { currency, rate_to_gel, effective_date } = body;

    // Validation
    if (!currency || !rate_to_gel || !effective_date) {
      return NextResponse.json(
        { error: 'ვალუტა, კურსი და თარიღი სავალდებულოა' },
        { status: 400 }
      );
    }

    if (!['USD', 'EUR'].includes(currency.toUpperCase())) {
      return NextResponse.json(
        { error: 'ვალუტა უნდა იყოს USD ან EUR' },
        { status: 400 }
      );
    }

    if (rate_to_gel <= 0) {
      return NextResponse.json(
        { error: 'კურსი უნდა იყოს დადებითი რიცხვი' },
        { status: 400 }
      );
    }

    // Insert or update (upsert)
    const result = await sql`
      INSERT INTO exchange_rates (currency, rate_to_gel, effective_date)
      VALUES (${currency.toUpperCase()}, ${rate_to_gel}, ${effective_date})
      ON CONFLICT (currency, effective_date)
      DO UPDATE SET rate_to_gel = ${rate_to_gel}
      RETURNING *
    ` as Record<string, unknown>[];

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error('Error creating exchange rate:', error);
    return NextResponse.json({ error: 'Failed to create exchange rate' }, { status: 500 });
  }
}
