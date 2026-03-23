'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';

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

interface StatusBreakdown {
  status: string;
  order_count: number;
  revenue: number;
  courier: number;
}

interface PaymentBreakdown {
  payment_type: string;
  order_count: number;
  revenue: number;
  courier: number;
}

interface LocationBreakdown {
  location: string;
  order_count: number;
  revenue: number;
  courier: number;
}

interface Summary {
  total_orders: number;
  total_revenue: number;
  total_courier: number;
  total_cost: number;
  total_profit: number;
  total_items_sold: number;
  average_order_value: number;
  profit_margin: number;
}

interface StatisticsData {
  summary: Summary;
  by_product: ProductStats[];
  by_date: DailyStats[];
  by_status: StatusBreakdown[];
  by_payment_type: PaymentBreakdown[];
  by_location: LocationBreakdown[];
  filters: {
    products: { id: number; name: string }[];
  };
}

type ViewMode = 'summary' | 'products' | 'daily' | 'status' | 'payment' | 'location';

const STATUS_LABELS: Record<string, string> = {
  pending: 'მოლოდინში',
  stickered: 'დასტიკერებული',
  shipped: 'გაგზავნილი',
  postponed: 'გადადებული',
  delivered: 'მიწოდებული',
  cancelled: 'გაუქმებული',
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'ხელზე გადახდა',
  transfer: 'ჩარიცხვა',
};

const LOCATION_LABELS: Record<string, string> = {
  tbilisi: 'თბილისი',
  region: 'რეგიონები', // Old value for backward compatibility
  city: 'ქალაქები',
  village: 'სოფლები',
};

export default function StatisticsPage() {
  const { status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StatisticsData | null>(null);
  const [error, setError] = useState('');

  // Filters - default to today
  const [startDate, setStartDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedPayment, setSelectedPayment] = useState('all');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [selectedPreset, setSelectedPreset] = useState('today');

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>('summary');

  const fetchStatistics = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);
      if (selectedProduct) params.set('product_id', selectedProduct);
      if (selectedStatus) params.set('status', selectedStatus);
      if (selectedPayment && selectedPayment !== 'all') params.set('payment_type', selectedPayment);
      if (selectedLocation && selectedLocation !== 'all') params.set('location', selectedLocation);

      const res = await fetch(`/api/statistics?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch statistics');

      const result = await res.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'შეცდომა მოხდა');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedProduct, selectedStatus, selectedPayment, selectedLocation]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchStatistics();
    }
  }, [status, fetchStatistics]);

  // Quick date presets
  const setDatePreset = (preset: string) => {
    const today = new Date();
    const formatDate = (d: Date) => d.toISOString().split('T')[0];
    setSelectedPreset(preset);

    switch (preset) {
      case 'today':
        setStartDate(formatDate(today));
        setEndDate(formatDate(today));
        break;
      case 'yesterday': {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        setStartDate(formatDate(yesterday));
        setEndDate(formatDate(yesterday));
        break;
      }
      case 'week': {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        setStartDate(formatDate(weekAgo));
        setEndDate(formatDate(today));
        break;
      }
      case 'month': {
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        setStartDate(formatDate(monthAgo));
        setEndDate(formatDate(today));
        break;
      }
      case 'year': {
        const yearAgo = new Date(today);
        yearAgo.setFullYear(yearAgo.getFullYear() - 1);
        setStartDate(formatDate(yearAgo));
        setEndDate(formatDate(today));
        break;
      }
      case 'all':
        setStartDate('');
        setEndDate('');
        break;
    }
  };

  const formatCurrency = (value: number) => `₾${value.toFixed(2)}`;
  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);
      if (selectedProduct) params.set('product_id', selectedProduct);
      if (selectedStatus && selectedStatus !== 'all') params.set('status', selectedStatus);
      if (selectedPayment && selectedPayment !== 'all') params.set('payment_type', selectedPayment);
      if (selectedLocation && selectedLocation !== 'all') params.set('location', selectedLocation);

      const response = await fetch(`/api/orders/export?${params.toString()}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // Extract filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      a.download = filenameMatch ? filenameMatch[1] : 'orders.xlsx';

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ექსპორტი ვერ მოხერხდა');
    } finally {
      setExporting(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-6"></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-4">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 mb-2"></div>
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-28"></div>
                </div>
              ))}
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
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">სტატისტიკა</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
            შემოსავლების, გაყიდვებისა და მოგების ანალიზი
          </p>
        </div>

        {/* Filters Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">ფილტრები</h2>

          {/* Date Presets */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              პერიოდი
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'today', label: 'დღეს' },
                { key: 'yesterday', label: 'გუშინ' },
                { key: 'week', label: '7 დღე' },
                { key: 'month', label: '30 დღე' },
                { key: 'year', label: '1 წელი' },
                { key: 'all', label: 'ყველა' },
              ].map((preset) => (
                <button
                  key={preset.key}
                  onClick={() => setDatePreset(preset.key)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    selectedPreset === preset.key
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date Range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                საწყისი თარიღი
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setSelectedPreset('');
                }}
                className="w-full px-3 py-2.5 text-base border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                საბოლოო თარიღი
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setSelectedPreset('');
                }}
                className="w-full px-3 py-2.5 text-base border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                პროდუქტი
              </label>
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="w-full px-3 py-2.5 text-base border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700"
              >
                <option value="">ყველა პროდუქტი</option>
                {data?.filters.products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                სტატუსი
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2.5 text-base border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700"
              >
                <option value="all">ყველა სტატუსი</option>
                <option value="pending">მოლოდინში</option>
                <option value="stickered">დასტიკერებული</option>
                <option value="shipped">გაგზავნილი</option>
                <option value="postponed">გადადებული</option>
                <option value="delivered">მიწოდებული</option>
                <option value="cancelled">გაუქმებული</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                გადახდის ტიპი
              </label>
              <select
                value={selectedPayment}
                onChange={(e) => setSelectedPayment(e.target.value)}
                className="w-full px-3 py-2.5 text-base border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700"
              >
                <option value="all">ყველა</option>
                <option value="cash">ხელზე გადახდა</option>
                <option value="transfer">ჩარიცხვა</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                ლოკაცია
              </label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full px-3 py-2.5 text-base border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700"
              >
                <option value="all">ყველა</option>
                <option value="tbilisi">თბილისი</option>
                <option value="regions">რეგიონები</option>
              </select>
            </div>
          </div>

          {/* Export Button */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="inline-flex items-center px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium rounded-lg transition-colors"
            >
              {exporting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  იტვირთება...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Excel-ში ჩამოტვირთვა
                </>
              )}
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              ჩამოტვირთავს ფილტრის მიხედვით შეკვეთებს (გაუქმებულის გარდა)
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {data && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">შეკვეთები</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-800 dark:text-white">
                  {data.summary.total_orders}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">გაყიდული ერთეული</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-800 dark:text-white">
                  {data.summary.total_items_sold}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">შემოსავალი</p>
                <p className="text-lg sm:text-2xl font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(data.summary.total_revenue)}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">კურიერი</p>
                <p className="text-lg sm:text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {formatCurrency(data.summary.total_courier)}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">თვითღირებულება</p>
                <p className="text-lg sm:text-2xl font-bold text-red-600 dark:text-red-400">
                  {formatCurrency(data.summary.total_cost)}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">წმინდა მოგება</p>
                <p className={`text-lg sm:text-2xl font-bold ${data.summary.total_profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatCurrency(data.summary.total_profit)}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">საშ. შეკვეთა</p>
                <p className="text-lg sm:text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {formatCurrency(data.summary.average_order_value)}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">მოგების მარჟა</p>
                <p className={`text-lg sm:text-2xl font-bold ${data.summary.profit_margin >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatPercent(data.summary.profit_margin)}
                </p>
              </div>
            </div>

            {/* View Mode Tabs */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
                <div className="flex min-w-max">
                  {[
                    { key: 'summary', label: 'მიმოხილვა' },
                    { key: 'products', label: 'პროდუქტები' },
                    { key: 'daily', label: 'დღეები' },
                    { key: 'status', label: 'სტატუსი' },
                    { key: 'payment', label: 'გადახდა' },
                    { key: 'location', label: 'ლოკაცია' },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setViewMode(tab.key as ViewMode)}
                      className={`px-4 py-3 text-sm font-medium transition-colors ${
                        viewMode === tab.key
                          ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 sm:p-6">
                {/* Summary View */}
                {viewMode === 'summary' && (
                  <div className="space-y-6">
                    {/* Top Products */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">
                        ტოპ პროდუქტები
                      </h3>
                      {data.by_product.length === 0 ? (
                        <p className="text-gray-500 dark:text-gray-400">მონაცემები არ არის</p>
                      ) : (
                        <div className="space-y-2">
                          {data.by_product.slice(0, 5).map((p) => (
                            <div
                              key={p.product_id}
                              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-800 dark:text-white truncate">
                                  {p.product_name}
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  {p.total_sold} ერთეული • {p.order_count} შეკვეთა
                                </p>
                              </div>
                              <div className="text-right ml-4">
                                <p className="font-bold text-green-600 dark:text-green-400">
                                  {formatCurrency(p.total_revenue)}
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  მოგება: {formatCurrency(p.total_profit)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Recent Days */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">
                        ბოლო დღეები
                      </h3>
                      {data.by_date.length === 0 ? (
                        <p className="text-gray-500 dark:text-gray-400">მონაცემები არ არის</p>
                      ) : (
                        <div className="space-y-2">
                          {data.by_date.slice(0, 7).map((d) => (
                            <div
                              key={d.date}
                              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                            >
                              <div>
                                <p className="font-medium text-gray-800 dark:text-white">
                                  {new Date(d.date).toLocaleDateString('ka-GE', {
                                    weekday: 'short',
                                    day: 'numeric',
                                    month: 'short',
                                  })}
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  {d.order_count} შეკვეთა • {d.items_sold} ერთეული
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-green-600 dark:text-green-400">
                                  {formatCurrency(d.total_revenue)}
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  მოგება: {formatCurrency(d.total_profit)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Products View */}
                {viewMode === 'products' && (
                  <div>
                    {data.by_product.length === 0 ? (
                      <p className="text-gray-500 dark:text-gray-400">მონაცემები არ არის</p>
                    ) : (
                      <>
                        {/* Desktop Table */}
                        <div className="hidden md:block overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b border-gray-200 dark:border-gray-700">
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">პროდუქტი</th>
                                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">გაყიდული</th>
                                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">შემოსავალი</th>
                                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">კურიერი</th>
                                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">თვითღირ.</th>
                                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">მოგება</th>
                                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">შეკვეთა</th>
                              </tr>
                            </thead>
                            <tbody>
                              {data.by_product.map((p) => (
                                <tr key={p.product_id} className="border-b border-gray-100 dark:border-gray-700">
                                  <td className="py-3 px-4 text-gray-800 dark:text-white">{p.product_name}</td>
                                  <td className="py-3 px-4 text-right text-gray-800 dark:text-white">{p.total_sold}</td>
                                  <td className="py-3 px-4 text-right text-green-600 dark:text-green-400 font-medium">{formatCurrency(p.total_revenue)}</td>
                                  <td className="py-3 px-4 text-right text-orange-600 dark:text-orange-400">{formatCurrency(p.total_courier)}</td>
                                  <td className="py-3 px-4 text-right text-red-600 dark:text-red-400">{formatCurrency(p.total_cost)}</td>
                                  <td className={`py-3 px-4 text-right font-medium ${p.total_profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {formatCurrency(p.total_profit)}
                                  </td>
                                  <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-400">{p.order_count}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Mobile Cards */}
                        <div className="md:hidden space-y-3">
                          {data.by_product.map((p) => (
                            <div key={p.product_id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                              <p className="font-medium text-gray-800 dark:text-white mb-2">{p.product_name}</p>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                  <span className="text-gray-500 dark:text-gray-400">გაყიდული: </span>
                                  <span className="text-gray-800 dark:text-white">{p.total_sold}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500 dark:text-gray-400">შეკვეთა: </span>
                                  <span className="text-gray-800 dark:text-white">{p.order_count}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500 dark:text-gray-400">შემოსავალი: </span>
                                  <span className="text-green-600 dark:text-green-400 font-medium">{formatCurrency(p.total_revenue)}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500 dark:text-gray-400">კურიერი: </span>
                                  <span className="text-orange-600 dark:text-orange-400">{formatCurrency(p.total_courier)}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500 dark:text-gray-400">თვითღირ.: </span>
                                  <span className="text-red-600 dark:text-red-400">{formatCurrency(p.total_cost)}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500 dark:text-gray-400">მოგება: </span>
                                  <span className={`font-medium ${p.total_profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {formatCurrency(p.total_profit)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Daily View */}
                {viewMode === 'daily' && (
                  <div>
                    {data.by_date.length === 0 ? (
                      <p className="text-gray-500 dark:text-gray-400">მონაცემები არ არის</p>
                    ) : (
                      <>
                        {/* Desktop Table */}
                        <div className="hidden md:block overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b border-gray-200 dark:border-gray-700">
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">თარიღი</th>
                                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">შეკვეთა</th>
                                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">ერთეული</th>
                                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">შემოსავალი</th>
                                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">კურიერი</th>
                                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">თვითღირ.</th>
                                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">მოგება</th>
                              </tr>
                            </thead>
                            <tbody>
                              {data.by_date.map((d) => (
                                <tr key={d.date} className="border-b border-gray-100 dark:border-gray-700">
                                  <td className="py-3 px-4 text-gray-800 dark:text-white">
                                    {new Date(d.date).toLocaleDateString('ka-GE')}
                                  </td>
                                  <td className="py-3 px-4 text-right text-gray-800 dark:text-white">{d.order_count}</td>
                                  <td className="py-3 px-4 text-right text-gray-800 dark:text-white">{d.items_sold}</td>
                                  <td className="py-3 px-4 text-right text-green-600 dark:text-green-400 font-medium">{formatCurrency(d.total_revenue)}</td>
                                  <td className="py-3 px-4 text-right text-orange-600 dark:text-orange-400">{formatCurrency(d.total_courier)}</td>
                                  <td className="py-3 px-4 text-right text-red-600 dark:text-red-400">{formatCurrency(d.total_cost)}</td>
                                  <td className={`py-3 px-4 text-right font-medium ${d.total_profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {formatCurrency(d.total_profit)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Mobile Cards */}
                        <div className="md:hidden space-y-3">
                          {data.by_date.map((d) => (
                            <div key={d.date} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                              <p className="font-medium text-gray-800 dark:text-white mb-2">
                                {new Date(d.date).toLocaleDateString('ka-GE', {
                                  weekday: 'long',
                                  day: 'numeric',
                                  month: 'long',
                                  year: 'numeric',
                                })}
                              </p>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                  <span className="text-gray-500 dark:text-gray-400">შეკვეთა: </span>
                                  <span className="text-gray-800 dark:text-white">{d.order_count}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500 dark:text-gray-400">ერთეული: </span>
                                  <span className="text-gray-800 dark:text-white">{d.items_sold}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500 dark:text-gray-400">შემოსავალი: </span>
                                  <span className="text-green-600 dark:text-green-400 font-medium">{formatCurrency(d.total_revenue)}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500 dark:text-gray-400">კურიერი: </span>
                                  <span className="text-orange-600 dark:text-orange-400">{formatCurrency(d.total_courier)}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500 dark:text-gray-400">თვითღირ.: </span>
                                  <span className="text-red-600 dark:text-red-400">{formatCurrency(d.total_cost)}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500 dark:text-gray-400">მოგება: </span>
                                  <span className={`font-medium ${d.total_profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {formatCurrency(d.total_profit)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Status View */}
                {viewMode === 'status' && (
                  <div>
                    {data.by_status.length === 0 ? (
                      <p className="text-gray-500 dark:text-gray-400">მონაცემები არ არის</p>
                    ) : (
                      <div className="space-y-3">
                        {data.by_status.map((s) => (
                          <div key={s.status} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                s.status === 'delivered'
                                  ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                                  : s.status === 'shipped'
                                  ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300'
                                  : s.status === 'pending'
                                  ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300'
                                  : s.status === 'stickered'
                                  ? 'bg-cyan-100 dark:bg-cyan-900 text-cyan-700 dark:text-cyan-300'
                                  : s.status === 'postponed'
                                  ? 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300'
                                  : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                              }`}>
                                {STATUS_LABELS[s.status] || s.status}
                              </span>
                              <span className="text-gray-600 dark:text-gray-400">
                                {s.order_count} შეკვეთა
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">შემოსავალი: </span>
                                <span className="text-green-600 dark:text-green-400 font-medium">
                                  {formatCurrency(Number(s.revenue))}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">კურიერი: </span>
                                <span className="text-orange-600 dark:text-orange-400">
                                  {formatCurrency(Number(s.courier))}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Payment View */}
                {viewMode === 'payment' && (
                  <div>
                    {data.by_payment_type.length === 0 ? (
                      <p className="text-gray-500 dark:text-gray-400">მონაცემები არ არის</p>
                    ) : (
                      <div className="space-y-3">
                        {data.by_payment_type.map((p) => (
                          <div key={p.payment_type} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-gray-800 dark:text-white">
                                {PAYMENT_LABELS[p.payment_type] || p.payment_type}
                              </span>
                              <span className="text-gray-600 dark:text-gray-400">
                                {p.order_count} შეკვეთა
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">შემოსავალი: </span>
                                <span className="text-green-600 dark:text-green-400 font-medium">
                                  {formatCurrency(Number(p.revenue))}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">კურიერი: </span>
                                <span className="text-orange-600 dark:text-orange-400">
                                  {formatCurrency(Number(p.courier))}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Location View */}
                {viewMode === 'location' && (
                  <div>
                    {!data.by_location || data.by_location.length === 0 ? (
                      <p className="text-gray-500 dark:text-gray-400">მონაცემები არ არის</p>
                    ) : (
                      <div className="space-y-3">
                        {data.by_location.map((l) => (
                          <div key={l.location} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                l.location === 'tbilisi'
                                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                                  : l.location === 'city'
                                  ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300'
                                  : l.location === 'village'
                                  ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                                  : 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300'
                              }`}>
                                {LOCATION_LABELS[l.location] || l.location}
                              </span>
                              <span className="text-gray-600 dark:text-gray-400">
                                {l.order_count} შეკვეთა
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">შემოსავალი: </span>
                                <span className="text-green-600 dark:text-green-400 font-medium">
                                  {formatCurrency(Number(l.revenue))}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">კურიერი: </span>
                                <span className="text-orange-600 dark:text-orange-400">
                                  {formatCurrency(Number(l.courier))}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
