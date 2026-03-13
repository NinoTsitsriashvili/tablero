import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';

const FB_AD_ACCOUNT_ID = process.env.FB_AD_ACCOUNT_ID || 'act_221097566364764';
const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;

interface FbInsightRow {
  spend: string;
  impressions: string;
  clicks: string;
  campaign_id?: string;
  campaign_name?: string;
  date_start: string;
  date_stop: string;
}

// Helper to get exchange rate for a date
async function getExchangeRate(sql: ReturnType<typeof getDb>, date: string): Promise<number | null> {
  const rates = await sql`
    SELECT rate_to_gel FROM exchange_rates
    WHERE currency = 'USD' AND effective_date <= ${date}
    ORDER BY effective_date DESC
    LIMIT 1
  ` as { rate_to_gel: number }[];

  return rates.length > 0 ? Number(rates[0].rate_to_gel) : null;
}

// POST - sync Facebook ad data
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!FB_ACCESS_TOKEN) {
    return NextResponse.json(
      { error: 'Facebook access token not configured' },
      { status: 500 }
    );
  }

  try {
    const sql = getDb();
    const body = await request.json();
    const { start_date, end_date } = body;

    // Default to last 30 days if no dates provided
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const startDate = start_date || thirtyDaysAgo.toISOString().split('T')[0];
    const endDate = end_date || today.toISOString().split('T')[0];

    // Fetch from Facebook API - account level daily breakdown
    const fbUrl = `https://graph.facebook.com/v19.0/${FB_AD_ACCOUNT_ID}/insights?` +
      `access_token=${FB_ACCESS_TOKEN}` +
      `&time_range={"since":"${startDate}","until":"${endDate}"}` +
      `&fields=spend,impressions,clicks,campaign_id,campaign_name` +
      `&level=campaign` +
      `&time_increment=1` +
      `&limit=500`;

    const response = await fetch(fbUrl);
    const data = await response.json();

    if (data.error) {
      console.error('Facebook API error:', data.error);
      return NextResponse.json(
        { error: data.error.message || 'Facebook API error' },
        { status: 400 }
      );
    }

    const insights: FbInsightRow[] = data.data || [];
    let syncedCount = 0;
    let skippedCount = 0;

    for (const row of insights) {
      const date = row.date_start;
      const spendUsd = parseFloat(row.spend) || 0;
      const impressions = parseInt(row.impressions) || 0;
      const clicks = parseInt(row.clicks) || 0;
      const campaignId = row.campaign_id || 'account_total';
      const campaignName = row.campaign_name || 'Account Total';

      // Get exchange rate for this date
      const exchangeRate = await getExchangeRate(sql, date);
      const spendGel = exchangeRate ? spendUsd * exchangeRate : null;

      // Upsert the record
      await sql`
        INSERT INTO fb_ad_spend (date, spend_usd, spend_gel, exchange_rate, impressions, clicks, campaign_id, campaign_name, synced_at)
        VALUES (${date}, ${spendUsd}, ${spendGel}, ${exchangeRate}, ${impressions}, ${clicks}, ${campaignId}, ${campaignName}, NOW())
        ON CONFLICT (date, campaign_id)
        DO UPDATE SET
          spend_usd = ${spendUsd},
          spend_gel = ${spendGel},
          exchange_rate = ${exchangeRate},
          impressions = ${impressions},
          clicks = ${clicks},
          campaign_name = ${campaignName},
          synced_at = NOW()
      `;
      syncedCount++;
    }

    // Also fetch account-level totals (aggregated per day)
    const accountUrl = `https://graph.facebook.com/v19.0/${FB_AD_ACCOUNT_ID}/insights?` +
      `access_token=${FB_ACCESS_TOKEN}` +
      `&time_range={"since":"${startDate}","until":"${endDate}"}` +
      `&fields=spend,impressions,clicks` +
      `&level=account` +
      `&time_increment=1` +
      `&limit=500`;

    const accountResponse = await fetch(accountUrl);
    const accountData = await accountResponse.json();

    if (!accountData.error && accountData.data) {
      for (const row of accountData.data as FbInsightRow[]) {
        const date = row.date_start;
        const spendUsd = parseFloat(row.spend) || 0;
        const impressions = parseInt(row.impressions) || 0;
        const clicks = parseInt(row.clicks) || 0;

        const exchangeRate = await getExchangeRate(sql, date);
        const spendGel = exchangeRate ? spendUsd * exchangeRate : null;

        await sql`
          INSERT INTO fb_ad_spend (date, spend_usd, spend_gel, exchange_rate, impressions, clicks, campaign_id, campaign_name, synced_at)
          VALUES (${date}, ${spendUsd}, ${spendGel}, ${exchangeRate}, ${impressions}, ${clicks}, 'daily_total', 'Daily Total', NOW())
          ON CONFLICT (date, campaign_id)
          DO UPDATE SET
            spend_usd = ${spendUsd},
            spend_gel = ${spendGel},
            exchange_rate = ${exchangeRate},
            impressions = ${impressions},
            clicks = ${clicks},
            synced_at = NOW()
        `;
      }
    }

    return NextResponse.json({
      message: 'Sync completed',
      synced: syncedCount,
      date_range: { start: startDate, end: endDate }
    });
  } catch (error) {
    console.error('Error syncing Facebook ads:', error);
    return NextResponse.json({ error: 'Failed to sync Facebook ads' }, { status: 500 });
  }
}

// GET - fetch synced ad data
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
    const groupBy = searchParams.get('group_by') || 'day'; // day, campaign

    let data;

    if (groupBy === 'campaign') {
      // Group by campaign
      if (startDate && endDate) {
        data = await sql`
          SELECT
            campaign_id,
            campaign_name,
            SUM(spend_usd) as total_spend_usd,
            SUM(spend_gel) as total_spend_gel,
            SUM(impressions) as total_impressions,
            SUM(clicks) as total_clicks,
            MIN(date) as first_date,
            MAX(date) as last_date
          FROM fb_ad_spend
          WHERE date >= ${startDate} AND date <= ${endDate}
            AND campaign_id != 'daily_total'
          GROUP BY campaign_id, campaign_name
          ORDER BY total_spend_usd DESC
        `;
      } else {
        data = await sql`
          SELECT
            campaign_id,
            campaign_name,
            SUM(spend_usd) as total_spend_usd,
            SUM(spend_gel) as total_spend_gel,
            SUM(impressions) as total_impressions,
            SUM(clicks) as total_clicks,
            MIN(date) as first_date,
            MAX(date) as last_date
          FROM fb_ad_spend
          WHERE campaign_id != 'daily_total'
          GROUP BY campaign_id, campaign_name
          ORDER BY total_spend_usd DESC
        `;
      }
    } else {
      // Daily totals only
      if (startDate && endDate) {
        data = await sql`
          SELECT * FROM fb_ad_spend
          WHERE date >= ${startDate} AND date <= ${endDate}
            AND campaign_id = 'daily_total'
          ORDER BY date DESC
        `;
      } else {
        data = await sql`
          SELECT * FROM fb_ad_spend
          WHERE campaign_id = 'daily_total'
          ORDER BY date DESC
        `;
      }
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching ad data:', error);
    return NextResponse.json({ error: 'Failed to fetch ad data' }, { status: 500 });
  }
}
