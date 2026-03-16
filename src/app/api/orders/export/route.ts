import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';
import * as XLSX from 'xlsx';

const STATUS_LABELS: Record<string, string> = {
  pending: 'მოლოდინში',
  stickered: 'დასტიკერებული',
  shipped: 'გაგზავნილი',
  postponed: 'გადადებული',
  delivered: 'მიწოდებული',
  cancelled: 'გაუქმებული',
};

interface OrderRow {
  id: number;
  recipient_name: string;
  phone: string;
  status: string;
  send_date: string | null;
  payment_type: string;
  location: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  courier_price: number;
}

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
    const productId = searchParams.get('product_id');
    const status = searchParams.get('status');
    const paymentType = searchParams.get('payment_type');
    const location = searchParams.get('location');

    // Fetch all order data
    const allOrdersData = await sql`
      SELECT o.id, o.recipient_name, o.phone, o.status, o.send_date, o.payment_type, o.location,
             p.name as product_name, oi.quantity, oi.unit_price, oi.courier_price
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN products p ON oi.product_id = p.id
      ORDER BY o.send_date DESC, o.id DESC
    ` as OrderRow[];

    // Filter in JavaScript
    const filteredData = allOrdersData.filter(row => {
      // Exclude cancelled orders by default
      if (row.status === 'cancelled') return false;

      // Date filter
      if (startDate && endDate) {
        if (!row.send_date) return false;
        const sendDate = new Date(row.send_date);
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setDate(end.getDate() + 1);
        if (sendDate < start || sendDate >= end) return false;
      }

      // Status filter
      if (status && status !== 'all' && row.status !== status) return false;

      // Payment filter
      if (paymentType && paymentType !== 'all' && row.payment_type !== paymentType) return false;

      // Location filter
      if (location && location !== 'all' && row.location !== location) return false;

      return true;
    });

    // If product filter is set, we need to check after grouping
    const productIdNum = productId ? parseInt(productId) : null;

    // Group by order ID
    const ordersMap = new Map<number, {
      id: number;
      recipient_name: string;
      phone: string;
      status: string;
      products: string[];
      total: number;
      courier: number;
    }>();

    for (const row of filteredData) {
      if (!ordersMap.has(row.id)) {
        ordersMap.set(row.id, {
          id: row.id,
          recipient_name: row.recipient_name,
          phone: row.phone,
          status: row.status,
          products: [],
          total: 0,
          courier: 0,
        });
      }

      const order = ordersMap.get(row.id)!;
      const productStr = `${row.product_name || 'უცნობი'} x${row.quantity}`;
      order.products.push(productStr);
      order.total += row.unit_price * row.quantity;
      order.courier += row.courier_price || 0;
    }

    // Convert to array for Excel
    const excelData = Array.from(ordersMap.values()).map(order => ({
      'შეკვეთის ID': order.id,
      'სახელი': order.recipient_name,
      'ტელეფონი': order.phone,
      'პროდუქტები': order.products.join(', '),
      'ჯამი (₾)': order.total.toFixed(2),
      'კურიერი (₾)': order.courier.toFixed(2),
      'სტატუსი': STATUS_LABELS[order.status] || order.status,
    }));

    if (excelData.length === 0) {
      return NextResponse.json({ error: 'No orders found for export' }, { status: 404 });
    }

    // Create workbook
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'შეკვეთები');

    // Set column widths
    worksheet['!cols'] = [
      { wch: 12 },  // ID
      { wch: 25 },  // Name
      { wch: 15 },  // Phone
      { wch: 50 },  // Products
      { wch: 12 },  // Total
      { wch: 12 },  // Courier
      { wch: 15 },  // Status
    ];

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Generate filename with date range
    const dateStr = startDate && endDate
      ? `${startDate}_${endDate}`
      : new Date().toISOString().split('T')[0];
    const filename = `orders_${dateStr}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error exporting orders:', error);
    return NextResponse.json({ error: 'Failed to export orders' }, { status: 500 });
  }
}
