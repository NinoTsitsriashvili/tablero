import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';

// Increase function timeout for large data syncs
export const maxDuration = 60;

const FB_AD_ACCOUNT_ID = process.env.FB_AD_ACCOUNT_ID;
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

  if (!FB_ACCESS_TOKEN || !FB_AD_ACCOUNT_ID) {
    return NextResponse.json(
      { error: 'Facebook credentials not configured' },
      { status: 500 }
    );
  }

  try {
    const sql = getDb();
    const body = await request.json();
    const { start_date, end_date } = body;

    const today = new Date();
    let startDate: string;
    let endDate: string;

    // If no dates provided, do incremental sync from last synced date
    if (!start_date || !start_date.trim() || !end_date || !end_date.trim()) {
      // Find the most recent synced date
      const lastSync = await sql`
        SELECT MAX(date) as last_date FROM fb_ad_spend WHERE campaign_id = 'daily_total'
      ` as { last_date: string | null }[];

      if (lastSync[0]?.last_date) {
        // Start from 2 days before last sync (to catch any late updates)
        const lastDate = new Date(lastSync[0].last_date);
        lastDate.setDate(lastDate.getDate() - 2);
        startDate = lastDate.toISOString().split('T')[0];
      } else {
        // No data yet, sync last 60 days (safe for Hobby plan timeout)
        const sixtyDaysAgo = new Date(today);
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
        startDate = sixtyDaysAgo.toISOString().split('T')[0];
      }
      endDate = today.toISOString().split('T')[0];
    } else {
      startDate = start_date.trim();
      endDate = end_date.trim();
    }

    // Fetch from Facebook API - account level daily breakdown
    const timeRange = encodeURIComponent(JSON.stringify({ since: startDate, until: endDate }));
    const fbUrl = `https://graph.facebook.com/v19.0/${FB_AD_ACCOUNT_ID}/insights?` +
      `access_token=${FB_ACCESS_TOKEN}` +
      `&time_range=${timeRange}` +
      `&fields=spend,impressions,clicks,campaign_id,campaign_name` +
      `&level=campaign` +
      `&time_increment=1` +
      `&limit=500`;

    const response = await fetch(fbUrl);
    const responseText = await response.text();

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error('Facebook API returned non-JSON response:', responseText.substring(0, 500));
      return NextResponse.json(
        { error: 'Facebook API returned invalid response. Please check your access token.' },
        { status: 400 }
      );
    }

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
      `&time_range=${timeRange}` +
      `&fields=spend,impressions,clicks` +
      `&level=account` +
      `&time_increment=1` +
      `&limit=500`;

    const accountResponse = await fetch(accountUrl);
    let accountData;
    try {
      accountData = await accountResponse.json();
    } catch {
      console.error('Failed to parse account-level response');
      accountData = { error: true };
    }

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
