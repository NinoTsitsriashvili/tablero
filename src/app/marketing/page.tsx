'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';

interface DailyAdSpend {
  date: string;
  spend_usd: number;
  spend_gel: number | null;
  impressions: number;
  clicks: number;
  exchange_rate: number | null;
}

interface Campaign {
  campaign_id: string;
  campaign_name: string;
  total_spend_usd: number;
  total_spend_gel: number | null;
  total_impressions: number;
  total_clicks: number;
}

interface Payment {
  id: number;
  payment_date: string;
  amount_usd: number;
  amount_gel: number | null;
  exchange_rate: number | null;
  description: string | null;
}

interface ExchangeRate {
  currency: string;
  rate_to_gel: number;
  effective_date: string;
}

interface Summary {
  total_spend_usd: number;
  total_spend_gel: number;
  total_impressions: number;
  total_clicks: number;
  days_with_ads: number;
  total_payments_usd: number;
  total_payments_gel: number;
  payment_count: number;
  total_orders: number;
  total_revenue: number;
  total_cost: number;
  total_courier: number;
  cost_per_order_usd: number;
  cost_per_order_gel: number;
  roas: number;
  ctr: number;
  cpc: number;
  profit_before_ads: number;
  profit_after_ads: number;
}

interface MarketingData {
  summary: Summary;
  daily_ad_spend: DailyAdSpend[];
  campaigns: Campaign[];
  payments: Payment[];
  exchange_rates: ExchangeRate[];
}

type ViewMode = 'summary' | 'daily' | 'campaigns' | 'payments' | 'settings';

export default function MarketingPage() {
  const { status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [data, setData] = useState<MarketingData | null>(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Filters
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [selectedPreset, setSelectedPreset] = useState('month');

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>('summary');

  // New payment form
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [newPayment, setNewPayment] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    amount_usd: '',
    exchange_rate: '',
    description: '',
  });

  // New exchange rate form
  const [showRateForm, setShowRateForm] = useState(false);
  const [newRate, setNewRate] = useState({
    currency: 'USD',
    rate_to_gel: '',
    effective_date: new Date().toISOString().split('T')[0],
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);

      const res = await fetch(`/api/marketing-statistics?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch marketing data');

      const result = await res.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'შეცდომა მოხდა');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchData();
    }
  }, [status, fetchData]);

  // Date presets
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

  // Sync Facebook data
  const syncFacebookData = async () => {
    setSyncing(true);
    setError('');
    setSuccessMessage('');

    try {
      const res = await fetch('/api/fb-ads/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: startDate || undefined,
          end_date: endDate || undefined,
        }),
      });

      const text = await res.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch {
        console.error('Failed to parse sync response:', text.substring(0, 200));
        throw new Error('სერვერმა არასწორი პასუხი დააბრუნა. სცადეთ თავიდან.');
      }

      if (!res.ok) {
        throw new Error(result.error || 'Sync failed');
      }

      setSuccessMessage(`სინქრონიზაცია დასრულდა: ${result.synced} ჩანაწერი`);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'სინქრონიზაცია ვერ მოხერხდა');
    } finally {
      setSyncing(false);
    }
  };

  // Add payment
  const addPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch('/api/fb-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_date: newPayment.payment_date,
          amount_usd: parseFloat(newPayment.amount_usd),
          exchange_rate: newPayment.exchange_rate ? parseFloat(newPayment.exchange_rate) : undefined,
          description: newPayment.description || undefined,
        }),
      });

      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || 'Failed to add payment');
      }

      setSuccessMessage('გადახდა დაემატა');
      setShowPaymentForm(false);
      setNewPayment({
        payment_date: new Date().toISOString().split('T')[0],
        amount_usd: '',
        exchange_rate: '',
        description: '',
      });
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'გადახდის დამატება ვერ მოხერხდა');
    }
  };

  // Delete payment
  const deletePayment = async (id: number) => {
    if (!confirm('ნამდვილად გსურთ წაშლა?')) return;

    try {
      const res = await fetch(`/api/fb-payments/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setSuccessMessage('გადახდა წაიშალა');
      fetchData();
    } catch (err) {
      setError('წაშლა ვერ მოხერხდა');
    }
  };

  // Add exchange rate
  const addExchangeRate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch('/api/exchange-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currency: newRate.currency,
          rate_to_gel: parseFloat(newRate.rate_to_gel),
          effective_date: newRate.effective_date,
        }),
      });

      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || 'Failed to add rate');
      }

      setSuccessMessage('კურსი დაემატა');
      setShowRateForm(false);
      setNewRate({
        currency: 'USD',
        rate_to_gel: '',
        effective_date: new Date().toISOString().split('T')[0],
      });
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'კურსის დამატება ვერ მოხერხდა');
    }
  };

  const formatCurrency = (value: number | null | undefined, currency: 'USD' | 'GEL' = 'GEL') => {
    const num = value ?? 0;
    if (currency === 'USD') return `$${num.toFixed(2)}`;
    return `₾${num.toFixed(2)}`;
  };

  const formatPercent = (value: number | null | undefined) => `${(value ?? 0).toFixed(2)}%`;
  const formatNumber = (value: number | null | undefined) => (value ?? 0).toLocaleString('ka-GE');

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
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">მარკეტინგი</h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
              Facebook რეკლამის ხარჯები და ROI ანალიზი
            </p>
          </div>
          {/* Facebook sync temporarily disabled */}
          <div className="px-4 py-2 bg-gray-400 text-white rounded-lg opacity-50 cursor-not-allowed flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            სინქრონიზაცია გათიშულია
          </div>
        </div>

        {/* Success/Error Messages */}
        {successMessage && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-green-600 dark:text-green-400">{successMessage}</p>
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          </div>
        </div>

        {data && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">რეკლამის ხარჯი</p>
                <p className="text-lg sm:text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {formatCurrency(data.summary.total_spend_usd, 'USD')}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {data.summary.total_spend_gel ? formatCurrency(data.summary.total_spend_gel) : '-'}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">გადახდილი</p>
                <p className="text-lg sm:text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {formatCurrency(data.summary.total_payments_usd, 'USD')}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {data.summary.total_payments_gel ? formatCurrency(data.summary.total_payments_gel) : '-'}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">შეკვეთები</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-800 dark:text-white">
                  {formatNumber(data.summary.total_orders)}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">შემოსავალი</p>
                <p className="text-lg sm:text-2xl font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(data.summary.total_revenue)}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">ხარჯი/შეკვეთა</p>
                <p className="text-lg sm:text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {formatCurrency(data.summary.cost_per_order_usd, 'USD')}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {data.summary.cost_per_order_gel ? formatCurrency(data.summary.cost_per_order_gel) : '-'}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">ROAS</p>
                <p className={`text-lg sm:text-2xl font-bold ${(data.summary.roas ?? 0) >= 1 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {(data.summary.roas ?? 0).toFixed(2)}x
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">მოგება (რეკლამამდე)</p>
                <p className={`text-lg sm:text-2xl font-bold ${(data.summary.profit_before_ads ?? 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatCurrency(data.summary.profit_before_ads)}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">წმინდა მოგება</p>
                <p className={`text-lg sm:text-2xl font-bold ${(data.summary.profit_after_ads ?? 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatCurrency(data.summary.profit_after_ads)}
                </p>
              </div>
            </div>

            {/* Additional Metrics */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">Impressions</p>
                <p className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
                  {formatNumber(data.summary.total_impressions)}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">Clicks</p>
                <p className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
                  {formatNumber(data.summary.total_clicks)}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">CTR</p>
                <p className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
                  {formatPercent(data.summary.ctr)}
                </p>
              </div>
            </div>

            {/* View Mode Tabs */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
                <div className="flex min-w-max">
                  {[
                    { key: 'summary', label: 'მიმოხილვა' },
                    { key: 'daily', label: 'დღეები' },
                    { key: 'campaigns', label: 'კამპანიები' },
                    { key: 'payments', label: 'გადახდები' },
                    { key: 'settings', label: 'პარამეტრები' },
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
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">
                        ბოლო დღეები
                      </h3>
                      {data.daily_ad_spend.length === 0 ? (
                        <p className="text-gray-500 dark:text-gray-400">მონაცემები არ არის. დააჭირეთ &quot;Facebook სინქრონიზაცია&quot; ღილაკს.</p>
                      ) : (
                        <div className="space-y-2">
                          {data.daily_ad_spend.slice(0, 7).map((d) => (
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
                                  {formatNumber(d.impressions)} imp • {formatNumber(d.clicks)} clicks
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-blue-600 dark:text-blue-400">
                                  {formatCurrency(Number(d.spend_usd), 'USD')}
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  {d.spend_gel ? formatCurrency(Number(d.spend_gel)) : '-'}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">
                        ბოლო გადახდები
                      </h3>
                      {data.payments.length === 0 ? (
                        <p className="text-gray-500 dark:text-gray-400">გადახდები არ არის დამატებული.</p>
                      ) : (
                        <div className="space-y-2">
                          {data.payments.slice(0, 5).map((p) => (
                            <div
                              key={p.id}
                              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                            >
                              <div>
                                <p className="font-medium text-gray-800 dark:text-white">
                                  {new Date(p.payment_date).toLocaleDateString('ka-GE')}
                                </p>
                                {p.description && (
                                  <p className="text-sm text-gray-500 dark:text-gray-400">{p.description}</p>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-orange-600 dark:text-orange-400">
                                  {formatCurrency(Number(p.amount_usd), 'USD')}
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  {p.amount_gel ? formatCurrency(Number(p.amount_gel)) : '-'}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Daily View */}
                {viewMode === 'daily' && (
                  <div>
                    {data.daily_ad_spend.length === 0 ? (
                      <p className="text-gray-500 dark:text-gray-400">მონაცემები არ არის.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-700">
                              <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">თარიღი</th>
                              <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">ხარჯი (USD)</th>
                              <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">ხარჯი (GEL)</th>
                              <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Impressions</th>
                              <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Clicks</th>
                              <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">კურსი</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.daily_ad_spend.map((d) => (
                              <tr key={d.date} className="border-b border-gray-100 dark:border-gray-700">
                                <td className="py-3 px-4 text-gray-800 dark:text-white">
                                  {new Date(d.date).toLocaleDateString('ka-GE')}
                                </td>
                                <td className="py-3 px-4 text-right text-blue-600 dark:text-blue-400 font-medium">
                                  {formatCurrency(Number(d.spend_usd), 'USD')}
                                </td>
                                <td className="py-3 px-4 text-right text-gray-800 dark:text-white">
                                  {d.spend_gel ? formatCurrency(Number(d.spend_gel)) : '-'}
                                </td>
                                <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-400">
                                  {formatNumber(d.impressions)}
                                </td>
                                <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-400">
                                  {formatNumber(d.clicks)}
                                </td>
                                <td className="py-3 px-4 text-right text-gray-500 dark:text-gray-400">
                                  {d.exchange_rate ? Number(d.exchange_rate).toFixed(4) : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Campaigns View */}
                {viewMode === 'campaigns' && (
                  <div>
                    {data.campaigns.length === 0 ? (
                      <p className="text-gray-500 dark:text-gray-400">კამპანიები არ არის.</p>
                    ) : (
                      <div className="space-y-3">
                        {data.campaigns.map((c) => (
                          <div key={c.campaign_id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <p className="font-medium text-gray-800 dark:text-white">{c.campaign_name}</p>
                              <p className="font-bold text-blue-600 dark:text-blue-400">
                                {formatCurrency(Number(c.total_spend_usd), 'USD')}
                              </p>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-sm">
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">GEL: </span>
                                <span className="text-gray-800 dark:text-white">
                                  {c.total_spend_gel ? formatCurrency(Number(c.total_spend_gel)) : '-'}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Imp: </span>
                                <span className="text-gray-800 dark:text-white">{formatNumber(Number(c.total_impressions))}</span>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Clicks: </span>
                                <span className="text-gray-800 dark:text-white">{formatNumber(Number(c.total_clicks))}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Payments View */}
                {viewMode === 'payments' && (
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-white">გადახდების ისტორია</h3>
                      <button
                        onClick={() => setShowPaymentForm(!showPaymentForm)}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                      >
                        + დამატება
                      </button>
                    </div>

                    {showPaymentForm && (
                      <form onSubmit={addPayment} className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              თარიღი
                            </label>
                            <input
                              type="date"
                              value={newPayment.payment_date}
                              onChange={(e) => setNewPayment({ ...newPayment, payment_date: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-white"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              თანხა (USD)
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              value={newPayment.amount_usd}
                              onChange={(e) => setNewPayment({ ...newPayment, amount_usd: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-white"
                              placeholder="0.00"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              კურსი (არასავალდებულო)
                            </label>
                            <input
                              type="number"
                              step="0.0001"
                              value={newPayment.exchange_rate}
                              onChange={(e) => setNewPayment({ ...newPayment, exchange_rate: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-white"
                              placeholder="2.72"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              აღწერა
                            </label>
                            <input
                              type="text"
                              value={newPayment.description}
                              onChange={(e) => setNewPayment({ ...newPayment, description: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-white"
                              placeholder="მარტის გადახდა"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                          >
                            შენახვა
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowPaymentForm(false)}
                            className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-white rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500"
                          >
                            გაუქმება
                          </button>
                        </div>
                      </form>
                    )}

                    {data.payments.length === 0 ? (
                      <p className="text-gray-500 dark:text-gray-400">გადახდები არ არის დამატებული.</p>
                    ) : (
                      <div className="space-y-2">
                        {data.payments.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                          >
                            <div>
                              <p className="font-medium text-gray-800 dark:text-white">
                                {new Date(p.payment_date).toLocaleDateString('ka-GE')}
                              </p>
                              {p.description && (
                                <p className="text-sm text-gray-500 dark:text-gray-400">{p.description}</p>
                              )}
                              {p.exchange_rate && (
                                <p className="text-xs text-gray-400">კურსი: {Number(p.exchange_rate).toFixed(4)}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="font-bold text-orange-600 dark:text-orange-400">
                                  {formatCurrency(Number(p.amount_usd), 'USD')}
                                </p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  {p.amount_gel ? formatCurrency(Number(p.amount_gel)) : '-'}
                                </p>
                              </div>
                              <button
                                onClick={() => deletePayment(p.id)}
                                className="text-red-500 hover:text-red-700 p-1"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Settings View */}
                {viewMode === 'settings' && (
                  <div className="space-y-6">
                    {/* Exchange Rates */}
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">გაცვლითი კურსები</h3>
                        <button
                          onClick={() => setShowRateForm(!showRateForm)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                        >
                          + დამატება
                        </button>
                      </div>

                      {showRateForm && (
                        <form onSubmit={addExchangeRate} className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                ვალუტა
                              </label>
                              <select
                                value={newRate.currency}
                                onChange={(e) => setNewRate({ ...newRate, currency: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-white"
                              >
                                <option value="USD">USD</option>
                                <option value="EUR">EUR</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                კურსი (GEL)
                              </label>
                              <input
                                type="number"
                                step="0.0001"
                                value={newRate.rate_to_gel}
                                onChange={(e) => setNewRate({ ...newRate, rate_to_gel: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-white"
                                placeholder="2.7200"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                თარიღი
                              </label>
                              <input
                                type="date"
                                value={newRate.effective_date}
                                onChange={(e) => setNewRate({ ...newRate, effective_date: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-800 dark:text-white"
                                required
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                            >
                              შენახვა
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowRateForm(false)}
                              className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-white rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500"
                            >
                              გაუქმება
                            </button>
                          </div>
                        </form>
                      )}

                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                        მიმდინარე კურსები (გამოიყენება ავტომატურად კონვერტაციისთვის)
                      </p>

                      {data.exchange_rates.length === 0 ? (
                        <p className="text-gray-500 dark:text-gray-400">კურსები არ არის დამატებული.</p>
                      ) : (
                        <div className="space-y-2">
                          {data.exchange_rates.map((r, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                            >
                              <div>
                                <p className="font-medium text-gray-800 dark:text-white">1 {r.currency}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  {new Date(r.effective_date).toLocaleDateString('ka-GE')}-დან
                                </p>
                              </div>
                              <p className="font-bold text-gray-800 dark:text-white">
                                = {(Number(r.rate_to_gel) || 0).toFixed(4)} GEL
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Token Info */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">Facebook API</h3>
                      <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          ტოკენის ვადა: <span className="font-medium text-gray-800 dark:text-white">2026 წლის 13 მაისი</span>
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Ad Account ID: <span className="font-medium text-gray-800 dark:text-white">221097566364764</span>
                        </p>
                      </div>
                    </div>
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
