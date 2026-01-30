'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import OrderForm from '@/components/OrderForm';

export interface Order {
  id: number;
  fb_name: string;
  recipient_name: string;
  phone: string;
  address: string;
  product_id: number;
  product_name: string | null;
  product_photo_url: string | null;
  product_price: number;
  courier_price: number;
  total_price: number;
  comment: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function OrdersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchOrders();
    }
  }, [session]);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOrderSaved = () => {
    setShowForm(false);
    fetchOrders();
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
      processing: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
      shipped: 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200',
      delivered: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
      cancelled: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
    };
    const labels: Record<string, string> = {
      pending: 'მოლოდინში',
      processing: 'მუშავდება',
      shipped: 'გაგზავნილი',
      delivered: 'მიწოდებული',
      cancelled: 'გაუქმებული',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.pending}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 py-8">
          <p className="text-gray-600 dark:text-gray-400">იტვირთება...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">შეკვეთები</h1>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors cursor-pointer"
          >
            შეკვეთის დამატება
          </button>
        </div>

        {showForm && (
          <div className="mb-6">
            <OrderForm
              onSave={handleOrderSaved}
              onCancel={() => setShowForm(false)}
            />
          </div>
        )}

        {orders.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
            <p className="text-gray-600 dark:text-gray-400">შეკვეთები არ არის. დაამატეთ პირველი შეკვეთა!</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">FB სახელი</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">ადრესატი</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">პროდუქტი</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">ჯამი</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">სტატუსი</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">თარიღი</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-3">
                        <Link href={`/orders/${order.id}`} className="text-gray-800 dark:text-white font-medium hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer">
                          {order.fb_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-gray-800 dark:text-white">{order.recipient_name}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{order.phone}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-800 dark:text-gray-300">
                        {order.product_name || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-gray-800 dark:text-gray-300">
                        ₾{Number(order.total_price).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(order.status)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {new Date(order.created_at).toLocaleDateString('ka-GE', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
