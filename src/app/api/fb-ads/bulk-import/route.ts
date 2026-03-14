import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// This endpoint is for one-time bulk import of historical data
// Protected by SETUP_KEY

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { setupKey, data } = body;

    if (setupKey !== process.env.SETUP_KEY) {
      return NextResponse.json({ error: 'Invalid setup key' }, { status: 403 });
    }

    if (!Array.isArray(data)) {
      return NextResponse.json({ error: 'Data must be an array' }, { status: 400 });
    }

    const sql = getDb();
    let importedCount = 0;

    for (const row of data) {
      const { date, spend_usd, impressions, clicks, campaign_id, campaign_name } = row;

      await sql`
        INSERT INTO fb_ad_spend (date, spend_usd, spend_gel, exchange_rate, impressions, clicks, campaign_id, campaign_name, synced_at)
        VALUES (${date}, ${spend_usd}, NULL, NULL, ${impressions || 0}, ${clicks || 0}, ${campaign_id || 'daily_total'}, ${campaign_name || 'Daily Total'}, NOW())
        ON CONFLICT (date, campaign_id)
        DO UPDATE SET
          spend_usd = ${spend_usd},
          impressions = ${impressions || 0},
          clicks = ${clicks || 0},
          campaign_name = ${campaign_name || 'Daily Total'},
          synced_at = NOW()
      `;
      importedCount++;
    }

    return NextResponse.json({
      message: 'Bulk import completed',
      imported: importedCount
    });
  } catch (error) {
    console.error('Bulk import error:', error);
    return NextResponse.json({ error: 'Bulk import failed' }, { status: 500 });
  }
}
