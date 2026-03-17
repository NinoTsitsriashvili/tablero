import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';

const STATUS_LABELS: Record<string, string> = {
  pending: 'მოლოდინში',
  stickered: 'დასტიკერებული',
  shipped: 'გაგზავნილი',
  postponed: 'გადადებული',
  delivered: 'მიწოდებული',
  cancelled: 'გაუქმებული',
};

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sql = getDb();
    const today = new Date().toISOString().split('T')[0];

    // Get today's orders with items
    const todayOrders = await sql`
      SELECT o.*,
        COALESCE(SUM(oi.unit_price * oi.quantity), 0) as total_price,
        COALESCE(SUM(oi.courier_price), 0) as total_courier
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE DATE(o.send_date) = ${today}
      GROUP BY o.id
      ORDER BY o.created_at DESC
    ` as Record<string, unknown>[];

    // Get orders by status (all time, not cancelled)
    const ordersByStatus = await sql`
      SELECT status, COUNT(*) as count
      FROM orders
      WHERE status != 'cancelled'
      GROUP BY status
    ` as { status: string; count: number }[];

    // Get pending orders (need attention)
    const pendingOrders = await sql`
      SELECT o.id, o.recipient_name, o.phone, o.status, o.send_date, o.created_at,
        COALESCE(SUM(oi.unit_price * oi.quantity + oi.courier_price), 0) as total_price
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.status IN ('pending', 'stickered')
      GROUP BY o.id
      ORDER BY o.send_date ASC NULLS LAST, o.created_at ASC
      LIMIT 5
    ` as Record<string, unknown>[];

    // Get recent orders (last 5)
    const recentOrders = await sql`
      SELECT o.id, o.recipient_name, o.status, o.send_date, o.created_at,
        COALESCE(SUM(oi.unit_price * oi.quantity + oi.courier_price), 0) as total_price
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT 5
    ` as Record<string, unknown>[];

    // Get low stock products (quantity <= 5)
    const lowStockProducts = await sql`
      SELECT id, name, quantity, price
      FROM products
      WHERE deleted_at IS NULL AND quantity <= 5
      ORDER BY quantity ASC
      LIMIT 6
    ` as { id: number; name: string; quantity: number; price: number }[];

    // Get this week's revenue
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const weekStartStr = weekStart.toISOString().split('T')[0];

    const weeklyStats = await sql`
      SELECT
        COUNT(DISTINCT o.id) as order_count,
        COALESCE(SUM(oi.unit_price * oi.quantity), 0) as revenue,
        COALESCE(SUM(oi.courier_price), 0) as courier
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.send_date >= ${weekStartStr} AND o.status != 'cancelled'
    ` as { order_count: number; revenue: number; courier: number }[];

    // Get this month's revenue
    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartStr = monthStart.toISOString().split('T')[0];

    const monthlyStats = await sql`
      SELECT
        COUNT(DISTINCT o.id) as order_count,
        COALESCE(SUM(oi.unit_price * oi.quantity), 0) as revenue
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.send_date >= ${monthStartStr} AND o.status != 'cancelled'
    ` as { order_count: number; revenue: number }[];

    // Calculate today's stats
    const todayRevenue = todayOrders
      .filter(o => o.status !== 'cancelled')
      .reduce((sum, o) => sum + Number(o.total_price), 0);

    const todayOrderCount = todayOrders.filter(o => o.status !== 'cancelled').length;

    // Status counts
    const statusCounts: Record<string, number> = {};
    for (const row of ordersByStatus) {
      statusCounts[row.status] = Number(row.count);
    }

    return NextResponse.json({
      today: {
        orders: todayOrderCount,
        revenue: todayRevenue,
      },
      week: {
        orders: Number(weeklyStats[0]?.order_count || 0),
        revenue: Number(weeklyStats[0]?.revenue || 0),
      },
      month: {
        orders: Number(monthlyStats[0]?.order_count || 0),
        revenue: Number(monthlyStats[0]?.revenue || 0),
      },
      statusCounts: {
        pending: statusCounts.pending || 0,
        stickered: statusCounts.stickered || 0,
        shipped: statusCounts.shipped || 0,
        postponed: statusCounts.postponed || 0,
        delivered: statusCounts.delivered || 0,
      },
      pendingOrders: pendingOrders.map(o => ({
        id: o.id,
        recipient_name: o.recipient_name,
        phone: o.phone,
        status: o.status,
        status_label: STATUS_LABELS[o.status as string] || o.status,
        send_date: o.send_date,
        total_price: Number(o.total_price),
      })),
      recentOrders: recentOrders.map(o => ({
        id: o.id,
        recipient_name: o.recipient_name,
        status: o.status,
        status_label: STATUS_LABELS[o.status as string] || o.status,
        send_date: o.send_date,
        total_price: Number(o.total_price),
        created_at: o.created_at,
      })),
      lowStockProducts: lowStockProducts.map(p => ({
        id: p.id,
        name: p.name,
        quantity: Number(p.quantity),
        price: Number(p.price),
      })),
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
