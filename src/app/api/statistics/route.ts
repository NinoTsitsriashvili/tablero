import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';

interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  courier_price: number;
  cost_price: number | null;
}

interface Order {
  id: number;
  status: string;
  payment_type: string;
  created_at: string;
  items: OrderItem[];
}

interface ProductStats {
  product_id: number;
  product_name: string;
  total_sold: number;
  total_revenue: number;
  total_courier: number;
  total_cost: number;
  total_profit: number;
  order_count: number;
}

interface DailyStats {
  date: string;
  order_count: number;
  total_revenue: number;
  total_courier: number;
  total_cost: number;
  total_profit: number;
  items_sold: number;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sql = getDb();
    const { searchParams } = new URL(request.url);

    // Date filters
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const productId = searchParams.get('product_id');
    const status = searchParams.get('status'); // Filter by order status
    const paymentType = searchParams.get('payment_type');

    // Build date condition
    let dateCondition = '';
    const dateParams: string[] = [];

    if (startDate) {
      dateParams.push(`o.created_at >= '${startDate}'::date`);
    }
    if (endDate) {
      dateParams.push(`o.created_at < ('${endDate}'::date + INTERVAL '1 day')`);
    }
    if (dateParams.length > 0) {
      dateCondition = 'AND ' + dateParams.join(' AND ');
    }

    // Status filter - default to delivered only for revenue calculations
    const statusFilter = status || 'delivered';
    const statusCondition = statusFilter === 'all' ? '' : `AND o.status = '${statusFilter}'`;

    // Payment type filter
    const paymentCondition = paymentType && paymentType !== 'all' ? `AND o.payment_type = '${paymentType}'` : '';

    // Product filter
    const productCondition = productId ? `AND oi.product_id = ${productId}` : '';

    // Get all orders with items matching filters
    const ordersQuery = await sql`
      SELECT
        o.id,
        o.status,
        o.payment_type,
        o.created_at,
        oi.id as item_id,
        oi.product_id,
        p.name as product_name,
        oi.quantity,
        oi.unit_price,
        oi.courier_price,
        p.cost_price
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE 1=1 ${sql.unsafe(dateCondition)} ${sql.unsafe(statusCondition)} ${sql.unsafe(paymentCondition)} ${sql.unsafe(productCondition)}
      ORDER BY o.created_at DESC
    ` as unknown[];

    // Process data
    const ordersMap = new Map<number, Order>();
    const productStatsMap = new Map<number, ProductStats>();
    const dailyStatsMap = new Map<string, DailyStats>();

    for (const row of ordersQuery as Record<string, unknown>[]) {
      const orderId = row.id as number;
      const productIdNum = row.product_id as number;
      const productName = (row.product_name as string) || 'უცნობი პროდუქტი';
      const quantity = Number(row.quantity);
      const unitPrice = Number(row.unit_price);
      const courierPrice = Number(row.courier_price || 0);
      const costPrice = row.cost_price ? Number(row.cost_price) : null;
      const createdAt = new Date(row.created_at as string);
      const dateKey = createdAt.toISOString().split('T')[0];

      // Build order map
      if (!ordersMap.has(orderId)) {
        ordersMap.set(orderId, {
          id: orderId,
          status: row.status as string,
          payment_type: row.payment_type as string,
          created_at: row.created_at as string,
          items: [],
        });
      }
      ordersMap.get(orderId)!.items.push({
        id: row.item_id as number,
        order_id: orderId,
        product_id: productIdNum,
        product_name: productName,
        quantity,
        unit_price: unitPrice,
        courier_price: courierPrice,
        cost_price: costPrice,
      });

      // Calculate item totals
      const itemRevenue = unitPrice * quantity;
      const itemCourier = courierPrice;
      const itemCost = costPrice ? costPrice * quantity : 0;
      const itemProfit = costPrice ? itemRevenue - itemCost : 0;

      // Update product stats
      if (!productStatsMap.has(productIdNum)) {
        productStatsMap.set(productIdNum, {
          product_id: productIdNum,
          product_name: productName,
          total_sold: 0,
          total_revenue: 0,
          total_courier: 0,
          total_cost: 0,
          total_profit: 0,
          order_count: 0,
        });
      }
      const productStats = productStatsMap.get(productIdNum)!;
      productStats.total_sold += quantity;
      productStats.total_revenue += itemRevenue;
      productStats.total_courier += itemCourier;
      productStats.total_cost += itemCost;
      productStats.total_profit += itemProfit;

      // Update daily stats
      if (!dailyStatsMap.has(dateKey)) {
        dailyStatsMap.set(dateKey, {
          date: dateKey,
          order_count: 0,
          total_revenue: 0,
          total_courier: 0,
          total_cost: 0,
          total_profit: 0,
          items_sold: 0,
        });
      }
      const dailyStats = dailyStatsMap.get(dateKey)!;
      dailyStats.total_revenue += itemRevenue;
      dailyStats.total_courier += itemCourier;
      dailyStats.total_cost += itemCost;
      dailyStats.total_profit += itemProfit;
      dailyStats.items_sold += quantity;
    }

    // Count unique orders per product and per day
    for (const order of ordersMap.values()) {
      const dateKey = new Date(order.created_at).toISOString().split('T')[0];
      const dailyStats = dailyStatsMap.get(dateKey);
      if (dailyStats) {
        dailyStats.order_count++;
      }

      // Count orders per product
      const productIdsInOrder = new Set(order.items.map(item => item.product_id));
      for (const pid of productIdsInOrder) {
        const productStats = productStatsMap.get(pid);
        if (productStats) {
          productStats.order_count++;
        }
      }
    }

    // Calculate totals
    const totalOrders = ordersMap.size;
    let totalRevenue = 0;
    let totalCourier = 0;
    let totalCost = 0;
    let totalProfit = 0;
    let totalItemsSold = 0;

    for (const stats of productStatsMap.values()) {
      totalRevenue += stats.total_revenue;
      totalCourier += stats.total_courier;
      totalCost += stats.total_cost;
      totalProfit += stats.total_profit;
      totalItemsSold += stats.total_sold;
    }

    // Get status breakdown
    const statusBreakdownQuery = await sql`
      SELECT
        o.status,
        COUNT(DISTINCT o.id) as order_count,
        SUM(oi.unit_price * oi.quantity) as revenue,
        SUM(oi.courier_price) as courier
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      WHERE 1=1 ${sql.unsafe(dateCondition)} ${sql.unsafe(productCondition)} ${sql.unsafe(paymentCondition)}
      GROUP BY o.status
      ORDER BY order_count DESC
    ` as unknown[];

    // Get payment type breakdown
    const paymentBreakdownQuery = await sql`
      SELECT
        o.payment_type,
        COUNT(DISTINCT o.id) as order_count,
        SUM(oi.unit_price * oi.quantity) as revenue,
        SUM(oi.courier_price) as courier
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      WHERE 1=1 ${sql.unsafe(dateCondition)} ${sql.unsafe(statusCondition)} ${sql.unsafe(productCondition)}
      GROUP BY o.payment_type
      ORDER BY order_count DESC
    ` as unknown[];

    // Get all products for filter dropdown
    const allProducts = await sql`
      SELECT id, name FROM products WHERE deleted_at IS NULL ORDER BY name
    ` as { id: number; name: string }[];

    // Sort product stats by revenue
    const productStats = Array.from(productStatsMap.values()).sort(
      (a, b) => b.total_revenue - a.total_revenue
    );

    // Sort daily stats by date descending
    const dailyStats = Array.from(dailyStatsMap.values()).sort(
      (a, b) => b.date.localeCompare(a.date)
    );

    // Calculate average order value
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Calculate profit margin percentage
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    return NextResponse.json({
      summary: {
        total_orders: totalOrders,
        total_revenue: totalRevenue,
        total_courier: totalCourier,
        total_cost: totalCost,
        total_profit: totalProfit,
        total_items_sold: totalItemsSold,
        average_order_value: averageOrderValue,
        profit_margin: profitMargin,
      },
      by_product: productStats,
      by_date: dailyStats,
      by_status: statusBreakdownQuery,
      by_payment_type: paymentBreakdownQuery,
      filters: {
        products: allProducts,
      },
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    return NextResponse.json({ error: 'Failed to fetch statistics' }, { status: 500 });
  }
}
