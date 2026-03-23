'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';

interface DashboardData {
  today: { orders: number; revenue: number };
  week: { orders: number; revenue: number };
  month: { orders: number; revenue: number };
  statusCounts: {
    pending: number;
    stickered: number;
    shipped: number;
    postponed: number;
  };
  pendingOrders: {
    id: number;
    recipient_name: string;
    phone: string;
    status: string;
    status_label: string;
    send_date: string | null;
    total_price: number;
  }[];
  recentOrders: {
    id: number;
    recipient_name: string;
    status: string;
    status_label: string;
    send_date: string | null;
    total_price: number;
    created_at: string;
  }[];
  lowStockProducts: {
    id: number;
    name: string;
    quantity: number;
    price: number;
  }[];
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  stickered: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  shipped: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  postponed: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
};

export default function DashboardPage() {
  const { status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('დილა მშვიდობისა');
    else if (hour < 18) setGreeting('შუადღე მშვიდობისა');
    else setGreeting('საღამო მშვიდობისა');
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchDashboardData();
    }
  }, [status]);

  const fetchDashboardData = async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (res.ok) {
        const dashboardData = await res.json();
        setData(dashboardData);
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000) {
      return `₾${(value / 1000).toFixed(1)}k`;
    }
    return `₾${value.toFixed(0)}`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ka-GE', {
      day: 'numeric',
      month: 'short',
    });
  };

  const getTimeAgo = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'ახლახანს';
    if (diffMins < 60) return `${diffMins} წთ წინ`;
    if (diffHours < 24) return `${diffHours} სთ წინ`;
    return `${diffDays} დღის წინ`;
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 py-6">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48"></div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl p-6 h-32"></div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 h-64"></div>
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 h-64"></div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            {greeting}!
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            აი რა ხდება დღეს Tablero-ში
          </p>
        </div>

        {/* Quick Actions - Mobile */}
        <div className="grid grid-cols-4 gap-2 mb-6 sm:hidden">
          <Link
            href="/orders"
            className="flex flex-col items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl p-3 font-medium transition-colors touch-manipulation"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-xs">შეკვეთა</span>
          </Link>
          <Link
            href="/orders"
            className="flex flex-col items-center justify-center gap-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl p-3 font-medium transition-colors touch-manipulation"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="text-xs">შეკვეთები</span>
          </Link>
          <Link
            href="/storage"
            className="flex flex-col items-center justify-center gap-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl p-3 font-medium transition-colors touch-manipulation"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <span className="text-xs">საწყობი</span>
          </Link>
          <Link
            href="/statistics"
            className="flex flex-col items-center justify-center gap-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl p-3 font-medium transition-colors touch-manipulation"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="text-xs">სტატისტიკა</span>
          </Link>
        </div>

        {/* Quick Actions - Desktop */}
        <div className="hidden sm:grid grid-cols-4 gap-4 mb-6">
          <Link
            href="/orders"
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-all"
          >
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <p className="font-semibold">ახალი შეკვეთა</p>
              <p className="text-sm text-blue-100">დაამატე</p>
            </div>
          </Link>
          <Link
            href="/orders"
            className="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-all"
          >
            <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">შეკვეთები</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">ნახე ყველა</p>
            </div>
          </Link>
          <Link
            href="/storage"
            className="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-all"
          >
            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">საწყობი</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">მარაგის მართვა</p>
            </div>
          </Link>
          <Link
            href="/statistics"
            className="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-all"
          >
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">სტატისტიკა</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">ანალიზი</p>
            </div>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          {/* Today's Orders */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-4 sm:p-6 text-white shadow-lg shadow-blue-500/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-blue-100 text-sm">დღეს</span>
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold">{data?.today.orders || 0}</p>
            <p className="text-blue-100 text-sm mt-1">{formatCurrency(data?.today.revenue || 0)}</p>
          </div>

          {/* Weekly Revenue */}
          <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-4 sm:p-6 text-white shadow-lg shadow-green-500/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-green-100 text-sm">კვირა</span>
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold">{formatCurrency(data?.week.revenue || 0)}</p>
            <p className="text-green-100 text-sm mt-1">{data?.week.orders || 0} შეკვეთა</p>
          </div>

          {/* Pending Orders */}
          <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-4 sm:p-6 text-white shadow-lg shadow-amber-500/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-amber-100 text-sm">მოლოდინში</span>
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold">{(data?.statusCounts.pending || 0) + (data?.statusCounts.stickered || 0)}</p>
            <p className="text-amber-100 text-sm mt-1">საჭიროებს ყურადღებას</p>
          </div>

          {/* Monthly */}
          <div className="bg-gradient-to-br from-purple-500 to-violet-600 rounded-2xl p-4 sm:p-6 text-white shadow-lg shadow-purple-500/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-purple-100 text-sm">თვე</span>
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold">{formatCurrency(data?.month.revenue || 0)}</p>
            <p className="text-purple-100 text-sm mt-1">{data?.month.orders || 0} შეკვეთა</p>
          </div>
        </div>

        {/* Status Overview - Horizontal Scroll on Mobile */}
        <div className="mb-6 sm:mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">სტატუსები</h2>
          <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
            {[
              { key: 'pending', label: 'მოლოდინში', color: 'bg-yellow-500', count: data?.statusCounts.pending || 0 },
              { key: 'stickered', label: 'დასტიკერ.', color: 'bg-cyan-500', count: data?.statusCounts.stickered || 0 },
              { key: 'shipped', label: 'გაგზავნილი', color: 'bg-purple-500', count: data?.statusCounts.shipped || 0 },
              { key: 'postponed', label: 'გადადებული', color: 'bg-orange-500', count: data?.statusCounts.postponed || 0 },
            ].map((status) => (
              <Link
                key={status.key}
                href={`/orders?status=${status.key}`}
                className="flex-shrink-0 bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow min-w-[140px] sm:min-w-0"
              >
                <div className={`w-3 h-3 rounded-full ${status.color}`}></div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{status.label}</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{status.count}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pending Orders */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">საჭიროებს ყურადღებას</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">მოლოდინში & დასტიკერებული</p>
              </div>
              <Link
                href="/orders?status=pending"
                className="text-blue-600 dark:text-blue-400 text-sm font-medium hover:underline"
              >
                ყველა
              </Link>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {data?.pendingOrders && data.pendingOrders.length > 0 ? (
                data.pendingOrders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/orders/${order.id}`}
                    className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {order.recipient_name}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status]}`}>
                          {order.status_label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        #{order.id} • {formatDate(order.send_date)}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        ₾{order.total_price.toFixed(0)}
                      </p>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="p-8 text-center">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-gray-500 dark:text-gray-400">ყველაფერი დამუშავებულია!</p>
                </div>
              )}
            </div>
          </div>

          {/* Recent Orders */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">ბოლო შეკვეთები</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">ახლახანს დამატებული</p>
              </div>
              <Link
                href="/orders"
                className="text-blue-600 dark:text-blue-400 text-sm font-medium hover:underline"
              >
                ყველა
              </Link>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {data?.recentOrders && data.recentOrders.length > 0 ? (
                data.recentOrders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/orders/${order.id}`}
                    className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {order.recipient_name}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status]}`}>
                          {order.status_label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        {getTimeAgo(order.created_at)}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        ₾{order.total_price.toFixed(0)}
                      </p>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="p-8 text-center">
                  <p className="text-gray-500 dark:text-gray-400">შეკვეთები არ არის</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Low Stock Alert */}
        {data?.lowStockProducts && data.lowStockProducts.length > 0 && (
          <div className="mt-6 sm:mt-8 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 rounded-2xl p-4 sm:p-6 border border-red-200 dark:border-red-800/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900/50 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-red-800 dark:text-red-200">დაბალი მარაგი</h2>
                <p className="text-sm text-red-600 dark:text-red-400">ამ პროდუქტებს მარაგი ეწურება</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.lowStockProducts.map((product) => (
                <Link
                  key={product.id}
                  href={`/storage/${product.id}`}
                  className="bg-white dark:bg-gray-800 rounded-xl p-3 flex items-center justify-between hover:shadow-md transition-shadow"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {product.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      ₾{product.price.toFixed(0)}
                    </p>
                  </div>
                  <div className={`ml-3 px-2.5 py-1 rounded-lg text-sm font-bold ${
                    product.quantity === 0
                      ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                      : 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300'
                  }`}>
                    {product.quantity}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
