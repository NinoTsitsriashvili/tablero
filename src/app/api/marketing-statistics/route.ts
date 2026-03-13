import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';

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

    // Build date filter
    const hasDateFilter = startDate && endDate;

    // 1. Get ad spend totals (daily_total records only to avoid double counting)
    let adSpendData: Record<string, unknown>[];
    if (hasDateFilter) {
      adSpendData = await sql`
        SELECT
          SUM(spend_usd) as total_spend_usd,
          SUM(spend_gel) as total_spend_gel,
          SUM(impressions) as total_impressions,
          SUM(clicks) as total_clicks,
          COUNT(*) as days_count
        FROM fb_ad_spend
        WHERE campaign_id = 'daily_total'
          AND date >= ${startDate} AND date <= ${endDate}
      ` as Record<string, unknown>[];
    } else {
      adSpendData = await sql`
        SELECT
          SUM(spend_usd) as total_spend_usd,
          SUM(spend_gel) as total_spend_gel,
          SUM(impressions) as total_impressions,
          SUM(clicks) as total_clicks,
          COUNT(*) as days_count
        FROM fb_ad_spend
        WHERE campaign_id = 'daily_total'
      ` as Record<string, unknown>[];
    }

    // 2. Get payment totals
    let paymentData: Record<string, unknown>[];
    if (hasDateFilter) {
      paymentData = await sql`
        SELECT
          SUM(amount_usd) as total_payments_usd,
          SUM(amount_gel) as total_payments_gel,
          COUNT(*) as payment_count
        FROM fb_payments
        WHERE payment_date >= ${startDate} AND payment_date <= ${endDate}
      ` as Record<string, unknown>[];
    } else {
      paymentData = await sql`
        SELECT
          SUM(amount_usd) as total_payments_usd,
          SUM(amount_gel) as total_payments_gel,
          COUNT(*) as payment_count
        FROM fb_payments
      ` as Record<string, unknown>[];
    }

    // 3. Get order statistics from existing orders data
    let orderData: Record<string, unknown>[];
    if (hasDateFilter) {
      orderData = await sql`
        SELECT
          COUNT(DISTINCT o.id) as total_orders,
          SUM(oi.unit_price * oi.quantity) as total_revenue,
          SUM(COALESCE(p.cost_price, 0) * oi.quantity) as total_cost,
          SUM(oi.courier_price) as total_courier
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE o.send_date >= ${startDate} AND o.send_date <= ${endDate}
          AND o.status NOT IN ('cancelled')
      ` as Record<string, unknown>[];
    } else {
      orderData = await sql`
        SELECT
          COUNT(DISTINCT o.id) as total_orders,
          SUM(oi.unit_price * oi.quantity) as total_revenue,
          SUM(COALESCE(p.cost_price, 0) * oi.quantity) as total_cost,
          SUM(oi.courier_price) as total_courier
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE o.status NOT IN ('cancelled')
      ` as Record<string, unknown>[];
    }

    // 4. Get daily ad spend breakdown
    let dailyAdSpend;
    if (hasDateFilter) {
      dailyAdSpend = await sql`
        SELECT date, spend_usd, spend_gel, impressions, clicks, exchange_rate
        FROM fb_ad_spend
        WHERE campaign_id = 'daily_total'
          AND date >= ${startDate} AND date <= ${endDate}
        ORDER BY date DESC
      `;
    } else {
      dailyAdSpend = await sql`
        SELECT date, spend_usd, spend_gel, impressions, clicks, exchange_rate
        FROM fb_ad_spend
        WHERE campaign_id = 'daily_total'
        ORDER BY date DESC
        LIMIT 30
      `;
    }

    // 5. Get campaign breakdown
    let campaignBreakdown;
    if (hasDateFilter) {
      campaignBreakdown = await sql`
        SELECT
          campaign_id,
          campaign_name,
          SUM(spend_usd) as total_spend_usd,
          SUM(spend_gel) as total_spend_gel,
          SUM(impressions) as total_impressions,
          SUM(clicks) as total_clicks
        FROM fb_ad_spend
        WHERE campaign_id NOT IN ('daily_total', 'account_total')
          AND date >= ${startDate} AND date <= ${endDate}
        GROUP BY campaign_id, campaign_name
        ORDER BY total_spend_usd DESC
      `;
    } else {
      campaignBreakdown = await sql`
        SELECT
          campaign_id,
          campaign_name,
          SUM(spend_usd) as total_spend_usd,
          SUM(spend_gel) as total_spend_gel,
          SUM(impressions) as total_impressions,
          SUM(clicks) as total_clicks
        FROM fb_ad_spend
        WHERE campaign_id NOT IN ('daily_total', 'account_total')
        GROUP BY campaign_id, campaign_name
        ORDER BY total_spend_usd DESC
      `;
    }

    // 6. Get payment history
    let payments;
    if (hasDateFilter) {
      payments = await sql`
        SELECT * FROM fb_payments
        WHERE payment_date >= ${startDate} AND payment_date <= ${endDate}
        ORDER BY payment_date DESC
      `;
    } else {
      payments = await sql`
        SELECT * FROM fb_payments
        ORDER BY payment_date DESC
        LIMIT 20
      `;
    }

    // 7. Get latest exchange rates
    const latestRates = await sql`
      SELECT DISTINCT ON (currency) currency, rate_to_gel, effective_date
      FROM exchange_rates
      ORDER BY currency, effective_date DESC
    `;

    // Calculate derived metrics
    const adSpend = adSpendData[0] || {};
    const payment = paymentData[0] || {};
    const orders = orderData[0] || {};

    const totalSpendUsd = Number(adSpend.total_spend_usd) || 0;
    const totalSpendGel = Number(adSpend.total_spend_gel) || 0;
    const totalPaymentsUsd = Number(payment.total_payments_usd) || 0;
    const totalPaymentsGel = Number(payment.total_payments_gel) || 0;
    const totalOrders = Number(orders.total_orders) || 0;
    const totalRevenue = Number(orders.total_revenue) || 0;
    const totalCost = Number(orders.total_cost) || 0;
    const totalCourier = Number(orders.total_courier) || 0;
    const totalImpressions = Number(adSpend.total_impressions) || 0;
    const totalClicks = Number(adSpend.total_clicks) || 0;

    // Calculate key metrics
    const costPerOrder = totalOrders > 0 ? totalSpendUsd / totalOrders : 0;
    const costPerOrderGel = totalOrders > 0 ? totalSpendGel / totalOrders : 0;
    const roas = totalSpendUsd > 0 ? totalRevenue / totalSpendGel : 0; // Revenue is in GEL, so compare to GEL spend
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const cpc = totalClicks > 0 ? totalSpendUsd / totalClicks : 0;
    const profitBeforeAds = totalRevenue - totalCost - totalCourier;
    const profitAfterAds = profitBeforeAds - totalSpendGel;

    return NextResponse.json({
      summary: {
        // Ad spend
        total_spend_usd: totalSpendUsd,
        total_spend_gel: totalSpendGel,
        total_impressions: totalImpressions,
        total_clicks: totalClicks,
        days_with_ads: Number(adSpend.days_count) || 0,

        // Payments
        total_payments_usd: totalPaymentsUsd,
        total_payments_gel: totalPaymentsGel,
        payment_count: Number(payment.payment_count) || 0,

        // Orders (from existing data)
        total_orders: totalOrders,
        total_revenue: totalRevenue,
        total_cost: totalCost,
        total_courier: totalCourier,

        // Calculated metrics
        cost_per_order_usd: costPerOrder,
        cost_per_order_gel: costPerOrderGel,
        roas: roas,
        ctr: ctr,
        cpc: cpc,
        profit_before_ads: profitBeforeAds,
        profit_after_ads: profitAfterAds,
      },
      daily_ad_spend: dailyAdSpend,
      campaigns: campaignBreakdown,
      payments: payments,
      exchange_rates: latestRates,
    });
  } catch (error) {
    console.error('Error fetching marketing statistics:', error);
    return NextResponse.json({ error: 'Failed to fetch marketing statistics' }, { status: 500 });
  }
}
