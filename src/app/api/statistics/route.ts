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
  location: string;
  send_date: string | null;
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
    const location = searchParams.get('location'); // Filter by location (tbilisi/region)

    // Status filter - default to 'all' to show all orders
    const statusFilter = status || 'all';
    const locationFilter = location || 'all';

    // Build dynamic query with filters
    // We'll use a simpler approach - fetch all and filter in memory for complex combinations
    // This is more maintainable and the dataset is typically not huge for a small business

    let ordersQuery;

    // Base conditions arrays for building WHERE clause
    const hasDateFilter = startDate && endDate;
    const hasStatusFilter = statusFilter !== 'all';
    const hasPaymentFilter = paymentType && paymentType !== 'all';
    const hasProductFilter = !!productId;
    const hasLocationFilter = locationFilter !== 'all';

    // Build query based on active filters
    if (hasDateFilter && hasStatusFilter && hasPaymentFilter && hasProductFilter && hasLocationFilter) {
      ordersQuery = await sql`
        SELECT o.id, o.status, o.payment_type, o.location, o.send_date,
               oi.id as item_id, oi.product_id, p.name as product_name,
               oi.quantity, oi.unit_price, oi.courier_price, p.cost_price
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE o.send_date >= ${startDate}::date
          AND o.send_date < (${endDate}::date + INTERVAL '1 day')
          AND o.status = ${statusFilter}
          AND o.payment_type = ${paymentType}
          AND o.location = ${locationFilter}
          AND oi.product_id = ${parseInt(productId)}
        ORDER BY o.send_date DESC
      `;
    } else if (hasDateFilter && hasStatusFilter && hasPaymentFilter && hasLocationFilter) {
      ordersQuery = await sql`
        SELECT o.id, o.status, o.payment_type, o.location, o.send_date,
               oi.id as item_id, oi.product_id, p.name as product_name,
               oi.quantity, oi.unit_price, oi.courier_price, p.cost_price
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE o.send_date >= ${startDate}::date
          AND o.send_date < (${endDate}::date + INTERVAL '1 day')
          AND o.status = ${statusFilter}
          AND o.payment_type = ${paymentType}
          AND o.location = ${locationFilter}
        ORDER BY o.send_date DESC
      `;
    } else if (hasDateFilter && hasStatusFilter && hasProductFilter && hasLocationFilter) {
      ordersQuery = await sql`
        SELECT o.id, o.status, o.payment_type, o.location, o.send_date,
               oi.id as item_id, oi.product_id, p.name as product_name,
               oi.quantity, oi.unit_price, oi.courier_price, p.cost_price
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE o.send_date >= ${startDate}::date
          AND o.send_date < (${endDate}::date + INTERVAL '1 day')
          AND o.status = ${statusFilter}
          AND o.location = ${locationFilter}
          AND oi.product_id = ${parseInt(productId)}
        ORDER BY o.send_date DESC
      `;
    } else if (hasDateFilter && hasPaymentFilter && hasProductFilter && hasLocationFilter) {
      ordersQuery = await sql`
        SELECT o.id, o.status, o.payment_type, o.location, o.send_date,
               oi.id as item_id, oi.product_id, p.name as product_name,
               oi.quantity, oi.unit_price, oi.courier_price, p.cost_price
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE o.send_date >= ${startDate}::date
          AND o.send_date < (${endDate}::date + INTERVAL '1 day')
          AND o.payment_type = ${paymentType}
          AND o.location = ${locationFilter}
          AND oi.product_id = ${parseInt(productId)}
        ORDER BY o.send_date DESC
      `;
    } else if (hasDateFilter && hasStatusFilter && hasLocationFilter) {
      ordersQuery = await sql`
        SELECT o.id, o.status, o.payment_type, o.location, o.send_date,
               oi.id as item_id, oi.product_id, p.name as product_name,
               oi.quantity, oi.unit_price, oi.courier_price, p.cost_price
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE o.send_date >= ${startDate}::date
          AND o.send_date < (${endDate}::date + INTERVAL '1 day')
          AND o.status = ${statusFilter}
          AND o.location = ${locationFilter}
        ORDER BY o.send_date DESC
      `;
    } else if (hasDateFilter && hasPaymentFilter && hasLocationFilter) {
      ordersQuery = await sql`
        SELECT o.id, o.status, o.payment_type, o.location, o.send_date,
               oi.id as item_id, oi.product_id, p.name as product_name,
               oi.quantity, oi.unit_price, oi.courier_price, p.cost_price
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE o.send_date >= ${startDate}::date
          AND o.send_date < (${endDate}::date + INTERVAL '1 day')
          AND o.payment_type = ${paymentType}
          AND o.location = ${locationFilter}
        ORDER BY o.send_date DESC
      `;
    } else if (hasDateFilter && hasProductFilter && hasLocationFilter) {
      ordersQuery = await sql`
        SELECT o.id, o.status, o.payment_type, o.location, o.send_date,
               oi.id as item_id, oi.product_id, p.name as product_name,
               oi.quantity, oi.unit_price, oi.courier_price, p.cost_price
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE o.send_date >= ${startDate}::date
          AND o.send_date < (${endDate}::date + INTERVAL '1 day')
          AND o.location = ${locationFilter}
          AND oi.product_id = ${parseInt(productId)}
        ORDER BY o.send_date DESC
      `;
    } else if (hasDateFilter && hasLocationFilter) {
      ordersQuery = await sql`
        SELECT o.id, o.status, o.payment_type, o.location, o.send_date,
               oi.id as item_id, oi.product_id, p.name as product_name,
               oi.quantity, oi.unit_price, oi.courier_price, p.cost_price
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE o.send_date >= ${startDate}::date
          AND o.send_date < (${endDate}::date + INTERVAL '1 day')
          AND o.location = ${locationFilter}
        ORDER BY o.send_date DESC
      `;
    } else if (hasStatusFilter && hasPaymentFilter && hasProductFilter && hasLocationFilter) {
      ordersQuery = await sql`
        SELECT o.id, o.status, o.payment_type, o.location, o.send_date,
               oi.id as item_id, oi.product_id, p.name as product_name,
               oi.quantity, oi.unit_price, oi.courier_price, p.cost_price
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE o.status = ${statusFilter}
          AND o.payment_type = ${paymentType}
          AND o.location = ${locationFilter}
          AND oi.product_id = ${parseInt(productId)}
        ORDER BY o.send_date DESC
      `;
    } else if (hasStatusFilter && hasPaymentFilter && hasLocationFilter) {
      ordersQuery = await sql`
        SELECT o.id, o.status, o.payment_type, o.location, o.send_date,
               oi.id as item_id, oi.product_id, p.name as product_name,
               oi.quantity, oi.unit_price, oi.courier_price, p.cost_price
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE o.status = ${statusFilter}
          AND o.payment_type = ${paymentType}
          AND o.location = ${locationFilter}
        ORDER BY o.send_date DESC
      `;
    } else if (hasStatusFilter && hasProductFilter && hasLocationFilter) {
      ordersQuery = await sql`
        SELECT o.id, o.status, o.payment_type, o.location, o.send_date,
               oi.id as item_id, oi.product_id, p.name as product_name,
               oi.quantity, oi.unit_price, oi.courier_price, p.cost_price
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE o.status = ${statusFilter}
          AND o.location = ${locationFilter}
          AND oi.product_id = ${parseInt(productId)}
        ORDER BY o.send_date DESC
      `;
    } else if (hasPaymentFilter && hasProductFilter && hasLocationFilter) {
      ordersQuery = await sql`
        SELECT o.id, o.status, o.payment_type, o.location, o.send_date,
               oi.id as item_id, oi.product_id, p.name as product_name,
               oi.quantity, oi.unit_price, oi.courier_price, p.cost_price
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE o.payment_type = ${paymentType}
          AND o.location = ${locationFilter}
          AND oi.product_id = ${parseInt(productId)}
        ORDER BY o.send_date DESC
      `;
    } else if (hasStatusFilter && hasLocationFilter) {
      ordersQuery = await sql`
        SELECT o.id, o.status, o.payment_type, o.location, o.send_date,
               oi.id as item_id, oi.product_id, p.name as product_name,
               oi.quantity, oi.unit_price, oi.courier_price, p.cost_price
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE o.status = ${statusFilter}
          AND o.location = ${locationFilter}
        ORDER BY o.send_date DESC
      `;
    } else if (hasPaymentFilter && hasLocationFilter) {
      ordersQuery = await sql`
        SELECT o.id, o.status, o.payment_type, o.location, o.send_date,
               oi.id as item_id, oi.product_id, p.name as product_name,
               oi.quantity, oi.unit_price, oi.courier_price, p.cost_price
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE o.payment_type = ${paymentType}
          AND o.location = ${locationFilter}
        ORDER BY o.send_date DESC
      `;
    } else if (hasProductFilter && hasLocationFilter) {
      ordersQuery = await sql`
        SELECT o.id, o.status, o.payment_type, o.location, o.send_date,
               oi.id as item_id, oi.product_id, p.name as product_name,
               oi.quantity, oi.unit_price, oi.courier_price, p.cost_price
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE o.location = ${locationFilter}
          AND oi.product_id = ${parseInt(productId)}
        ORDER BY o.send_date DESC
      `;
    } else if (hasLocationFilter) {
      ordersQuery = await sql`
        SELECT o.id, o.status, o.payment_type, o.location, o.send_date,
               oi.id as item_id, oi.product_id, p.name as product_name,
               oi.quantity, oi.unit_price, oi.courier_price, p.cost_price
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE o.location = ${locationFilter}
        ORDER BY o.send_date DESC
      `;
    } else if (hasDateFilter && hasStatusFilter && hasPaymentFilter && hasProductFilter) {
      ordersQuery = await sql`
        SELECT o.id, o.status, o.payment_type, o.location, o.send_date,
               oi.id as item_id, oi.product_id, p.name as product_name,
               oi.quantity, oi.unit_price, oi.courier_price, p.cost_price
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE o.send_date >= ${startDate}::date
          AND o.send_date < (${endDate}::date + INTERVAL '1 day')
          AND o.status = ${statusFilter}
          AND o.payment_type = ${paymentType}
          AND oi.product_id = ${parseInt(productId)}
        ORDER BY o.send_date DESC
      `;
    } else if (hasDateFilter && hasStatusFilter && hasPaymentFilter) {
      ordersQuery = await sql`
        SELECT o.id, o.status, o.payment_type, o.location, o.send_date,
               oi.id as item_id, oi.product_id, p.name as product_name,
               oi.quantity, oi.unit_price, oi.courier_price, p.cost_price
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE o.send_date >= ${startDate}::date
          AND o.send_date < (${endDate}::date + INTERVAL '1 day')
          AND o.status = ${statusFilter}
          AND o.payment_type = ${paymentType}
        ORDER BY o.send_date DESC
      `;
    } else if (hasDateFilter && hasStatusFilter && hasProductFilter) {
      ordersQuery = await sql`
        SELECT o.id, o.status, o.payment_type, o.location, o.send_date,
               oi.id as item_id, oi.product_id, p.name as product_name,
               oi.quantity, oi.unit_price, oi.courier_price, p.cost_price
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE o.send_date >= ${startDate}::date
          AND o.send_date < (${endDate}::date + INTERVAL '1 day')
          AND o.status = ${statusFilter}
          AND oi.product_id = ${parseInt(productId)}
        ORDER BY o.send_date DESC
      `;
    } else if (hasDateFilter && hasStatusFilter) {
      ordersQuery = await sql`
        SELECT o.id, o.status, o.payment_type, o.location, o.send_date,
               oi.id as item_id, oi.product_id, p.name as product_name,
               oi.quantity, oi.unit_price, oi.courier_price, p.cost_price
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE o.send_date >= ${startDate}::date
          AND o.send_date < (${endDate}::date + INTERVAL '1 day')
          AND o.status = ${statusFilter}
        ORDER BY o.send_date DESC
      `;
    } else if (hasDateFilter && hasPaymentFilter) {
      ordersQuery = await sql`
        SELECT o.id, o.status, o.payment_type, o.location, o.send_date,
               oi.id as item_id, oi.product_id, p.name as product_name,
               oi.quantity, oi.unit_price, oi.courier_price, p.cost_price
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE o.send_date >= ${startDate}::date
          AND o.send_date < (${endDate}::date + INTERVAL '1 day')
          AND o.payment_type = ${paymentType}
        ORDER BY o.send_date DESC
      `;
    } else if (hasDateFilter && hasProductFilter) {
      ordersQuery = await sql`
        SELECT o.id, o.status, o.payment_type, o.location, o.send_date,
               oi.id as item_id, oi.product_id, p.name as product_name,
               oi.quantity, oi.unit_price, oi.courier_price, p.cost_price
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE o.send_date >= ${startDate}::date
          AND o.send_date < (${endDate}::date + INTERVAL '1 day')
          AND oi.product_id = ${parseInt(productId)}
        ORDER BY o.send_date DESC
      `;
    } else if (hasDateFilter) {
      ordersQuery = await sql`
        SELECT o.id, o.status, o.payment_type, o.location, o.send_date,
               oi.id as item_id, oi.product_id, p.name as product_name,
               oi.quantity, oi.unit_price, oi.courier_price, p.cost_price
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE o.send_date >= ${startDate}::date
          AND o.send_date < (${endDate}::date + INTERVAL '1 day')
        ORDER BY o.send_date DESC
      `;
    } else if (hasStatusFilter && hasPaymentFilter && hasProductFilter) {
      ordersQuery = await sql`
        SELECT o.id, o.status, o.payment_type, o.location, o.send_date,
               oi.id as item_id, oi.product_id, p.name as product_name,
               oi.quantity, oi.unit_price, oi.courier_price, p.cost_price
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE o.status = ${statusFilter}
          AND o.payment_type = ${paymentType}
          AND oi.product_id = ${parseInt(productId)}
        ORDER BY o.send_date DESC
      `;
    } else if (hasStatusFilter && hasPaymentFilter) {
      ordersQuery = await sql`
        SELECT o.id, o.status, o.payment_type, o.location, o.send_date,
               oi.id as item_id, oi.product_id, p.name as product_name,
               oi.quantity, oi.unit_price, oi.courier_price, p.cost_price
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE o.status = ${statusFilter}
          AND o.payment_type = ${paymentType}
        ORDER BY o.send_date DESC
      `;
    } else if (hasStatusFilter && hasProductFilter) {
      ordersQuery = await sql`
        SELECT o.id, o.status, o.payment_type, o.location, o.send_date,
               oi.id as item_id, oi.product_id, p.name as product_name,
               oi.quantity, oi.unit_price, oi.courier_price, p.cost_price
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE o.status = ${statusFilter}
          AND oi.product_id = ${parseInt(productId)}
        ORDER BY o.send_date DESC
      `;
    } else if (hasStatusFilter) {
      ordersQuery = await sql`
        SELECT o.id, o.status, o.payment_type, o.location, o.send_date,
               oi.id as item_id, oi.product_id, p.name as product_name,
               oi.quantity, oi.unit_price, oi.courier_price, p.cost_price
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE o.status = ${statusFilter}
        ORDER BY o.send_date DESC
      `;
    } else if (hasPaymentFilter && hasProductFilter) {
      ordersQuery = await sql`
        SELECT o.id, o.status, o.payment_type, o.location, o.send_date,
               oi.id as item_id, oi.product_id, p.name as product_name,
               oi.quantity, oi.unit_price, oi.courier_price, p.cost_price
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE o.payment_type = ${paymentType}
          AND oi.product_id = ${parseInt(productId)}
        ORDER BY o.send_date DESC
      `;
    } else if (hasPaymentFilter) {
      ordersQuery = await sql`
        SELECT o.id, o.status, o.payment_type, o.location, o.send_date,
               oi.id as item_id, oi.product_id, p.name as product_name,
               oi.quantity, oi.unit_price, oi.courier_price, p.cost_price
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE o.payment_type = ${paymentType}
        ORDER BY o.send_date DESC
      `;
    } else if (hasProductFilter) {
      ordersQuery = await sql`
        SELECT o.id, o.status, o.payment_type, o.location, o.send_date,
               oi.id as item_id, oi.product_id, p.name as product_name,
               oi.quantity, oi.unit_price, oi.courier_price, p.cost_price
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.product_id = ${parseInt(productId)}
        ORDER BY o.send_date DESC
      `;
    } else {
      // No filters - get all orders
      ordersQuery = await sql`
        SELECT o.id, o.status, o.payment_type, o.location, o.send_date,
               oi.id as item_id, oi.product_id, p.name as product_name,
               oi.quantity, oi.unit_price, oi.courier_price, p.cost_price
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        ORDER BY o.send_date DESC
      `;
    }

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
      const sendDate = row.send_date ? new Date(row.send_date as string) : null;
      const dateKey = sendDate ? sendDate.toISOString().split('T')[0] : null;

      // Build order map
      if (!ordersMap.has(orderId)) {
        ordersMap.set(orderId, {
          id: orderId,
          status: row.status as string,
          payment_type: row.payment_type as string,
          location: (row.location as string) || 'tbilisi',
          send_date: row.send_date as string | null,
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

      // Update daily stats (only for orders with send_date)
      if (dateKey) {
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
    }

    // Count unique orders per product and per day
    for (const order of ordersMap.values()) {
      // Only count in daily stats if order has send_date
      if (order.send_date) {
        const dateKey = new Date(order.send_date).toISOString().split('T')[0];
        const dailyStats = dailyStatsMap.get(dateKey);
        if (dailyStats) {
          dailyStats.order_count++;
        }
      }

      // Count orders per product
      const productIdsInOrder = new Set(order.items.map(item => item.product_id));
      for (const pid of productIdsInOrder) {
        const pStats = productStatsMap.get(pid);
        if (pStats) {
          pStats.order_count++;
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

    // Get status breakdown - always show all statuses
    const statusBreakdownQuery = await sql`
      SELECT
        o.status,
        COUNT(DISTINCT o.id) as order_count,
        COALESCE(SUM(oi.unit_price * oi.quantity), 0) as revenue,
        COALESCE(SUM(oi.courier_price), 0) as courier
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      GROUP BY o.status
      ORDER BY order_count DESC
    ` as unknown[];

    // Get payment type breakdown
    const paymentBreakdownQuery = await sql`
      SELECT
        o.payment_type,
        COUNT(DISTINCT o.id) as order_count,
        COALESCE(SUM(oi.unit_price * oi.quantity), 0) as revenue,
        COALESCE(SUM(oi.courier_price), 0) as courier
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      GROUP BY o.payment_type
      ORDER BY order_count DESC
    ` as unknown[];

    // Get location breakdown
    const locationBreakdownQuery = await sql`
      SELECT
        COALESCE(o.location, 'tbilisi') as location,
        COUNT(DISTINCT o.id) as order_count,
        COALESCE(SUM(oi.unit_price * oi.quantity), 0) as revenue,
        COALESCE(SUM(oi.courier_price), 0) as courier
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      GROUP BY o.location
      ORDER BY order_count DESC
    ` as unknown[];

    // Get all products for filter dropdown
    const allProducts = await sql`
      SELECT id, name FROM products WHERE deleted_at IS NULL ORDER BY name
    ` as { id: number; name: string }[];

    // Sort product stats by revenue
    const productStatsSorted = Array.from(productStatsMap.values()).sort(
      (a, b) => b.total_revenue - a.total_revenue
    );

    // Sort daily stats by date descending
    const dailyStatsSorted = Array.from(dailyStatsMap.values()).sort(
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
      by_product: productStatsSorted,
      by_date: dailyStatsSorted,
      by_status: statusBreakdownQuery,
      by_payment_type: paymentBreakdownQuery,
      by_location: locationBreakdownQuery,
      filters: {
        products: allProducts,
      },
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    return NextResponse.json({ error: 'Failed to fetch statistics' }, { status: 500 });
  }
}
