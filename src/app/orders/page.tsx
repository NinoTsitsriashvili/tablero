'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Navbar from '@/components/Navbar';
import OrderForm from '@/components/OrderForm';

// Status configuration
const STATUS_CONFIG = {
  pending: { label: 'მოლოდინში', style: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200' },
  stickered: { label: 'დასტიკერებული', style: 'bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-200' },
  shipped: { label: 'გაგზავნილი', style: 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200' },
  postponed: { label: 'გადადებული', style: 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200' },
  delivered: { label: 'მიწოდებული', style: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' },
  cancelled: { label: 'გაუქმებული', style: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200' },
};

const STATUS_ORDER = ['pending', 'stickered', 'shipped', 'postponed', 'delivered', 'cancelled'];

interface OrderItem {
  id: number;
  product_id: number;
  product_name: string | null;
  product_photo_url: string | null;
  quantity: number;
  unit_price: number;
  courier_price: number;
}

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
  location: string;
  created_at: string;
  updated_at: string;
  items_count: number;
  items: OrderItem[];
}

// Skeleton loader for order table rows
function OrderRowSkeleton() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
      </td>
      <td className="px-4 py-3">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-28 mb-1"></div>
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
      </td>
      <td className="px-4 py-3">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
      </td>
      <td className="px-4 py-3">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
      </td>
      <td className="px-4 py-3">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-20"></div>
      </td>
      <td className="px-4 py-3">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-14 ml-auto"></div>
      </td>
    </tr>
  );
}

// Skeleton loader for mobile cards
function OrderCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-2"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-1"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-28"></div>
        </div>
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-20"></div>
      </div>
      <div className="h-px bg-gray-200 dark:bg-gray-700 my-3"></div>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-28"></div>
      </div>
      <div className="flex items-center justify-between mt-3">
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState<number | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<number | null>(null);
  const [locationFilter, setLocationFilter] = useState<'all' | 'tbilisi' | 'region'>('all');
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const ITEMS_PER_PAGE = 10;

  // Filter orders based on search query and location
  const filteredOrders = orders.filter((order) => {
    // Location filter
    if (locationFilter !== 'all') {
      if (order.location !== locationFilter) return false;
    }

    // Search filter
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase().trim();
    const fbNameMatch = order.fb_name.toLowerCase().includes(query);
    const recipientMatch = order.recipient_name.toLowerCase().includes(query);
    const phoneMatch = order.phone.includes(query);
    return fbNameMatch || recipientMatch || phoneMatch;
  });

  // Pagination
  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Close status dropdown when clicking outside
  useEffect(() => {
    if (statusDropdownOpen === null) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      // Check if click is outside the dropdown
      const target = event.target as HTMLElement;
      const isInsideDropdown = target.closest('[data-status-dropdown]');
      if (!isInsideDropdown) {
        setStatusDropdownOpen(null);
      }
    };

    // Small delay to prevent immediate close
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside, true);
      document.addEventListener('touchend', handleClickOutside, true);
    }, 50);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleClickOutside, true);
      document.removeEventListener('touchend', handleClickOutside, true);
    };
  }, [statusDropdownOpen]);

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

  const updateOrderStatus = async (orderId: number, newStatus: string) => {
    setUpdatingStatus(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        // Update local state
        setOrders(orders.map(order =>
          order.id === orderId ? { ...order, status: newStatus } : order
        ));
      } else {
        const data = await res.json();
        alert(data.error || 'სტატუსის შეცვლა ვერ მოხერხდა');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('სტატუსის შეცვლა ვერ მოხერხდა');
    } finally {
      setUpdatingStatus(null);
      setStatusDropdownOpen(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.style}`}>
        {config.label}
      </span>
    );
  };

  // Interactive status badge with dropdown
  const StatusSelector = ({ order }: { order: Order }) => {
    const isOpen = statusDropdownOpen === order.id;
    const isUpdating = updatingStatus === order.id;
    const config = STATUS_CONFIG[order.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;

    const toggleDropdown = () => {
      setStatusDropdownOpen(isOpen ? null : order.id);
    };

    const selectStatus = (newStatus: string) => {
      if (order.status !== newStatus) {
        updateOrderStatus(order.id, newStatus);
      } else {
        setStatusDropdownOpen(null);
      }
    };

    return (
      <div className="relative" data-status-dropdown>
        <button
          type="button"
          onClick={toggleDropdown}
          disabled={isUpdating}
          className={`px-2 py-1 rounded-full text-xs font-medium ${config.style} cursor-pointer hover:opacity-80 active:opacity-60 transition-opacity flex items-center gap-1 select-none ${isUpdating ? 'opacity-50' : ''}`}
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          {isUpdating ? (
            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : null}
          {config.label}
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div
            className="absolute z-50 mt-1 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 right-0 md:left-0 md:right-auto"
            data-status-dropdown
          >
            {STATUS_ORDER.map((statusKey) => {
              const statusConfig = STATUS_CONFIG[statusKey as keyof typeof STATUS_CONFIG];
              const isCurrentStatus = order.status === statusKey;
              return (
                <button
                  type="button"
                  key={statusKey}
                  onClick={() => selectStatus(statusKey)}
                  className={`w-full px-3 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 flex items-center gap-2 select-none ${
                    isCurrentStatus ? 'bg-gray-50 dark:bg-gray-700' : ''
                  }`}
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  <span className={`w-2 h-2 rounded-full ${statusConfig.style.split(' ')[0]}`}></span>
                  <span className="text-gray-800 dark:text-gray-200">{statusConfig.label}</span>
                  {isCurrentStatus && (
                    <svg className="w-4 h-4 ml-auto text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Pagination component for reuse
  const PaginationControls = ({
    currentPage,
    totalPages,
    onPageChange,
    totalItems,
    itemsPerPage,
  }: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    totalItems: number;
    itemsPerPage: number;
  }) => {
    if (totalPages <= 1) return null;

    return (
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
        {/* Mobile pagination */}
        <div className="flex md:hidden flex-col items-center gap-3">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, totalItems)} / {totalItems}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 text-sm bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md hover:bg-gray-50 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-700 dark:text-gray-200"
            >
              წინა
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-300 px-2">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 text-sm bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md hover:bg-gray-50 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-700 dark:text-gray-200"
            >
              შემდეგი
            </button>
          </div>
        </div>

        {/* Desktop pagination */}
        <div className="hidden md:flex items-center justify-between">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            ნაჩვენებია {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, totalItems)} / {totalItems}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md hover:bg-gray-50 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-700 dark:text-gray-200"
            >
              წინა
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(page => {
                  if (totalPages <= 7) return true;
                  if (page === 1 || page === totalPages) return true;
                  if (Math.abs(page - currentPage) <= 1) return true;
                  return false;
                })
                .map((page, index, array) => (
                  <span key={page}>
                    {index > 0 && array[index - 1] !== page - 1 && (
                      <span className="px-1 text-gray-400">...</span>
                    )}
                    <button
                      onClick={() => onPageChange(page)}
                      className={`w-8 h-8 text-sm rounded-md transition-colors ${
                        currentPage === page
                          ? 'bg-blue-600 text-white'
                          : 'bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-500'
                      }`}
                    >
                      {page}
                    </button>
                  </span>
                ))}
            </div>
            <button
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md hover:bg-gray-50 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-700 dark:text-gray-200"
            >
              შემდეგი
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse"></div>
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-full sm:w-44 animate-pulse"></div>
          </div>

          {/* Mobile skeleton */}
          <div className="md:hidden space-y-3">
            <OrderCardSkeleton />
            <OrderCardSkeleton />
            <OrderCardSkeleton />
            <OrderCardSkeleton />
            <OrderCardSkeleton />
          </div>

          {/* Desktop skeleton */}
          <div className="hidden md:block bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
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
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  <OrderRowSkeleton />
                  <OrderRowSkeleton />
                  <OrderRowSkeleton />
                  <OrderRowSkeleton />
                  <OrderRowSkeleton />
                </tbody>
              </table>
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
        {/* Header - stacked on mobile, row on desktop */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">შეკვეთები</h1>
          <button
            onClick={() => setShowForm(true)}
            className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors cursor-pointer font-medium"
          >
            შეკვეთის დამატება
          </button>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          {/* Search Input */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-5 h-5 text-gray-400"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ძებნა..."
              className="w-full pl-10 pr-10 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-800"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-5 h-5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Location Filter Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => { setLocationFilter('all'); setCurrentPage(1); }}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                locationFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              ყველა
            </button>
            <button
              onClick={() => { setLocationFilter('tbilisi'); setCurrentPage(1); }}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                locationFilter === 'tbilisi'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              თბილისი
            </button>
            <button
              onClick={() => { setLocationFilter('region'); setCurrentPage(1); }}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                locationFilter === 'region'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              რეგიონები
            </button>
          </div>

          {/* Filter info */}
          {(searchQuery || locationFilter !== 'all') && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              ნაპოვნია: {filteredOrders.length} შეკვეთა
            </p>
          )}
        </div>

        {showForm && (
          <div className="mb-6">
            <OrderForm
              onSave={handleOrderSaved}
              onCancel={() => setShowForm(false)}
            />
          </div>
        )}

        {loading ? (
          <>
            {/* Mobile skeleton */}
            <div className="md:hidden space-y-3">
              <OrderCardSkeleton />
              <OrderCardSkeleton />
              <OrderCardSkeleton />
              <OrderCardSkeleton />
              <OrderCardSkeleton />
            </div>

            {/* Desktop skeleton */}
            <div className="hidden md:block bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
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
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    <OrderRowSkeleton />
                    <OrderRowSkeleton />
                    <OrderRowSkeleton />
                    <OrderRowSkeleton />
                    <OrderRowSkeleton />
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : orders.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
            <p className="text-gray-600 dark:text-gray-400">შეკვეთები არ არის. დაამატეთ პირველი შეკვეთა!</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
            <p className="text-gray-600 dark:text-gray-400">შეკვეთა ვერ მოიძებნა &quot;{searchQuery}&quot;</p>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {paginatedOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 hover:shadow-md transition-shadow"
                >
                  {/* Header: Name and Status */}
                  <div className="flex items-start justify-between mb-2">
                    <Link
                      href={`/orders/${order.id}`}
                      className="flex-1 min-w-0 pr-2"
                    >
                      <h3 className="font-medium text-gray-800 dark:text-white truncate hover:text-blue-600 dark:hover:text-blue-400">
                        {order.fb_name}
                      </h3>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {order.recipient_name}
                      </div>
                      <div className="text-sm text-gray-400 dark:text-gray-500">
                        {order.phone}
                      </div>
                    </Link>
                    <StatusSelector order={order} />
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-gray-200 dark:bg-gray-700 my-3"></div>

                  {/* Products */}
                  <div className="space-y-2">
                    {order.items && order.items.length > 0 ? (
                      order.items.slice(0, 2).map((item, index) => (
                        <div key={item.id || index} className="flex items-center gap-2">
                          {item.product_photo_url ? (
                            <Image
                              src={item.product_photo_url}
                              alt={item.product_name || 'პროდუქტი'}
                              width={32}
                              height={32}
                              className="rounded object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center flex-shrink-0">
                              <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-gray-800 dark:text-gray-200 truncate">
                              {item.product_name || 'უცნობი პროდუქტი'}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {item.quantity} ც. × ₾{Number(item.unit_price).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : order.product_name ? (
                      <div className="flex items-center gap-2">
                        {order.product_photo_url ? (
                          <Image
                            src={order.product_photo_url}
                            alt={order.product_name || 'პროდუქტი'}
                            width={32}
                            height={32}
                            className="rounded object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                        <span className="text-sm text-gray-800 dark:text-gray-200 truncate">
                          {order.product_name}
                        </span>
                      </div>
                    ) : null}
                    {order.items && order.items.length > 2 && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        +{order.items.length - 2} სხვა პროდუქტი
                      </div>
                    )}
                  </div>

                  {/* Footer: Total, Date, and View Button */}
                  <Link
                    href={`/orders/${order.id}`}
                    className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700"
                  >
                    <span className="font-medium text-gray-800 dark:text-white">
                      ₾{Number(order.total_price).toFixed(2)}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {order.send_date ? new Date(order.send_date).toLocaleDateString('ka-GE', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        }) : '--'}
                      </span>
                      <span className="text-blue-600 dark:text-blue-400">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </span>
                    </div>
                  </Link>
                </div>
              ))}

              {/* Mobile Pagination */}
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalItems={filteredOrders.length}
                itemsPerPage={ITEMS_PER_PAGE}
              />
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">FB სახელი</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">ადრესატი</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">პროდუქტი</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">ჯამი</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">სტატუსი</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">გაგზავნის თარიღი</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {paginatedOrders.map((order) => (
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
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-2">
                            {order.items && order.items.length > 0 ? (
                              order.items.map((item, index) => (
                                <div key={item.id || index} className="flex items-center gap-2">
                                  {item.product_photo_url ? (
                                    <Image
                                      src={item.product_photo_url}
                                      alt={item.product_name || 'პროდუქტი'}
                                      width={32}
                                      height={32}
                                      className="rounded object-cover flex-shrink-0"
                                    />
                                  ) : (
                                    <div className="w-8 h-8 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center flex-shrink-0">
                                      <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                      </svg>
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <div className="text-sm text-gray-800 dark:text-gray-200 truncate">
                                      {item.product_name || 'უცნობი პროდუქტი'}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                      {item.quantity} ც. × ₾{Number(item.unit_price).toFixed(2)}
                                    </div>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="flex items-center gap-2">
                                {order.product_photo_url ? (
                                  <Image
                                    src={order.product_photo_url}
                                    alt={order.product_name || 'პროდუქტი'}
                                    width={32}
                                    height={32}
                                    className="rounded object-cover flex-shrink-0"
                                  />
                                ) : (
                                  <div className="w-8 h-8 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center flex-shrink-0">
                                    <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                  </div>
                                )}
                                <span className="text-sm text-gray-800 dark:text-gray-200">
                                  {order.product_name || 'N/A'}
                                </span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-800 dark:text-gray-300">
                          ₾{Number(order.total_price).toFixed(2)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusSelector order={order} />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                          {order.send_date ? new Date(order.send_date).toLocaleDateString('ka-GE', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          }) : '--'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/orders/${order.id}`}
                            className="px-3 py-1.5 text-sm bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors cursor-pointer"
                          >
                            ნახვა
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Desktop Pagination */}
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalItems={filteredOrders.length}
                itemsPerPage={ITEMS_PER_PAGE}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
