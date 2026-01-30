'use client';

import { useState, useEffect, use } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import ProductForm from '@/components/ProductForm';
import { Product } from '../page';

interface HistoryEntry {
  id: number;
  product_id: number;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  note: string | null;
  created_at: string;
}

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session, status } = useSession();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditForm, setShowEditForm] = useState(false);
  const [error, setError] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    if (session && id) {
      fetchProduct();
    }
  }, [session, id]);

  const fetchProduct = async () => {
    try {
      const res = await fetch(`/api/products/${id}`);
      if (res.ok) {
        const data = await res.json();
        setProduct(data);
      } else {
        setError('პროდუქტი ვერ მოიძებნა');
      }
    } catch (error) {
      console.error('Error fetching product:', error);
      setError('შეცდომა მოხდა');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('ნამდვილად გსურთ პროდუქტის წაშლა?')) {
      return;
    }

    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        router.push('/storage');
      }
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  const handleProductSaved = () => {
    setShowEditForm(false);
    fetchProduct();
    if (historyOpen) {
      fetchHistory();
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/products/${id}/history`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const toggleHistory = () => {
    if (!historyOpen && history.length === 0) {
      fetchHistory();
    }
    setHistoryOpen(!historyOpen);
  };

  const getFieldLabel = (field: string | null): string => {
    const labels: Record<string, string> = {
      name: 'დასახელება',
      price: 'ფასი',
      cost_price: 'თვითღირებულება',
      quantity: 'რაოდენობა',
      description: 'აღწერა',
      barcode: 'შტრიხკოდი',
      photo_url: 'ფოტო',
    };
    return field ? labels[field] || field : '';
  };

  const getActionLabel = (action: string): string => {
    const labels: Record<string, string> = {
      created: 'შექმნა',
      updated: 'განახლება',
      stock_added: 'მარაგის დამატება',
      stock_removed: 'მარაგის გამოკლება',
    };
    return labels[action] || action;
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined || value === '') {
      return '--';
    }
    return String(value);
  };

  const parseSnapshot = (jsonStr: string | null): Record<string, unknown> | null => {
    if (!jsonStr) return null;
    try {
      return JSON.parse(jsonStr);
    } catch {
      return null;
    }
  };

  const renderHistoryEntry = (entry: HistoryEntry) => {
    if (entry.action === 'created') {
      const snapshot = parseSnapshot(entry.new_value);
      if (snapshot) {
        return (
          <div className="space-y-1 text-sm">
            <div><span className="text-gray-500 dark:text-gray-400">დასახელება:</span> <span className="text-green-600 dark:text-green-400">{formatValue(snapshot.name)}</span></div>
            <div><span className="text-gray-500 dark:text-gray-400">ფასი:</span> <span className="text-green-600 dark:text-green-400">{snapshot.price ? `₾${Number(snapshot.price).toFixed(2)}` : '--'}</span></div>
            <div><span className="text-gray-500 dark:text-gray-400">თვითღირებულება:</span> <span className="text-green-600 dark:text-green-400">{snapshot.cost_price ? `₾${Number(snapshot.cost_price).toFixed(2)}` : '--'}</span></div>
            <div><span className="text-gray-500 dark:text-gray-400">რაოდენობა:</span> <span className="text-green-600 dark:text-green-400">{formatValue(snapshot.quantity)}</span></div>
            <div><span className="text-gray-500 dark:text-gray-400">აღწერა:</span> <span className="text-green-600 dark:text-green-400">{formatValue(snapshot.description)}</span></div>
            <div><span className="text-gray-500 dark:text-gray-400">შტრიხკოდი:</span> <span className="text-green-600 dark:text-green-400">{formatValue(snapshot.barcode)}</span></div>
            <div><span className="text-gray-500 dark:text-gray-400">ფოტო:</span> <span className="text-green-600 dark:text-green-400">{snapshot.photo_url ? 'დამატებულია' : '--'}</span></div>
          </div>
        );
      }
      // Fallback for old format
      return <span className="text-green-600 dark:text-green-400">{entry.new_value || '--'}</span>;
    }

    if (entry.action === 'updated') {
      const oldSnapshot = parseSnapshot(entry.old_value);
      const newSnapshot = parseSnapshot(entry.new_value);
      const changedFields = entry.field_name?.split(',') || [];

      if (oldSnapshot && newSnapshot) {
        const fields = [
          { key: 'name', label: 'დასახელება' },
          { key: 'price', label: 'ფასი', format: (v: unknown) => v ? `₾${Number(v).toFixed(2)}` : '--' },
          { key: 'cost_price', label: 'თვითღირებულება', format: (v: unknown) => v ? `₾${Number(v).toFixed(2)}` : '--' },
          { key: 'quantity', label: 'რაოდენობა' },
          { key: 'description', label: 'აღწერა' },
          { key: 'barcode', label: 'შტრიხკოდი' },
          { key: 'photo_url', label: 'ფოტო', format: (v: unknown) => v ? 'დამატებულია' : '--' },
        ];

        return (
          <div className="space-y-1 text-sm">
            {fields.map(({ key, label, format }) => {
              const oldVal = oldSnapshot[key];
              const newVal = newSnapshot[key];
              const isChanged = changedFields.includes(key);
              const formatFn = format || formatValue;

              return (
                <div key={key}>
                  <span className="text-gray-500 dark:text-gray-400">{label}:</span>{' '}
                  {isChanged ? (
                    <>
                      <span className="text-red-500 dark:text-red-400 line-through">{formatFn(oldVal)}</span>
                      {' → '}
                      <span className="text-green-600 dark:text-green-400">{formatFn(newVal)}</span>
                    </>
                  ) : (
                    <span className="text-gray-700 dark:text-gray-300">{formatFn(newVal)}</span>
                  )}
                </div>
              );
            })}
          </div>
        );
      }

      // Fallback for old format (single field changes)
      return (
        <span>
          <span className="text-red-500 dark:text-red-400 line-through">{entry.old_value || '--'}</span>
          {' → '}
          <span className="text-green-600 dark:text-green-400">{entry.new_value || '--'}</span>
        </span>
      );
    }

    return null;
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <p className="text-gray-600 dark:text-gray-400">იტვირთება...</p>
        </main>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <p className="text-red-500 dark:text-red-400">{error || 'პროდუქტი ვერ მოიძებნა'}</p>
            <Link href="/storage" className="text-blue-600 dark:text-blue-400 hover:underline mt-4 inline-block">
              დაბრუნება საწყობში
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const price = Number(product.price);
  const costPrice = product.cost_price ? Number(product.cost_price) : null;
  const profit = costPrice !== null ? price - costPrice : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/storage" className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            საწყობში დაბრუნება
          </Link>
        </div>

        {showEditForm ? (
          <ProductForm
            product={product}
            onSave={handleProductSaved}
            onCancel={() => setShowEditForm(false)}
          />
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            {product.photo_url && (
              <div className="relative h-64 w-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.photo_url}
                  alt={product.name}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            )}

            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-800 dark:text-white">{product.name}</h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">ID: {product.id}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowEditForm(true)}
                    className="px-4 py-2 text-sm bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                  >
                    რედაქტირება
                  </button>
                  <button
                    onClick={handleDelete}
                    className="px-4 py-2 text-sm bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-md hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                  >
                    წაშლა
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">ფასი</p>
                  <p className="text-xl font-bold text-gray-800 dark:text-white">₾{price.toFixed(2)}</p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">თვითღირებულება</p>
                  <p className="text-xl font-bold text-gray-800 dark:text-white">
                    {costPrice !== null ? `₾${costPrice.toFixed(2)}` : '--'}
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">მარაგი</p>
                  <p className={`text-xl font-bold ${product.quantity > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {product.quantity}
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">მოგება</p>
                  <p className={`text-xl font-bold ${profit !== null ? (profit > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400') : 'text-gray-800 dark:text-white'}`}>
                    {profit !== null ? `₾${profit.toFixed(2)}` : '--'}
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">შტრიხკოდი</p>
                <p className="text-gray-800 dark:text-gray-300 font-mono">{product.barcode || '--'}</p>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">აღწერა</p>
                <p className="text-gray-800 dark:text-gray-300 whitespace-pre-wrap">{product.description || '--'}</p>
              </div>

              <div className="border-t dark:border-gray-700 pt-4 mt-4">
                <div className="grid grid-cols-2 gap-4 text-sm text-gray-500 dark:text-gray-400">
                  <div>
                    <span>შექმნილია: </span>
                    <span className="text-gray-800 dark:text-gray-300">
                      {new Date(product.created_at).toLocaleDateString('ka-GE')}
                    </span>
                  </div>
                  <div>
                    <span>განახლებულია: </span>
                    <span className="text-gray-800 dark:text-gray-300">
                      {new Date(product.updated_at).toLocaleDateString('ka-GE')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Collapsible History Tab */}
            <div className="border-t dark:border-gray-700">
              <button
                onClick={toggleHistory}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <span className="font-medium text-gray-800 dark:text-white">ისტორია</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform ${historyOpen ? 'rotate-180' : ''}`}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              {historyOpen && (
                <div className="px-6 pb-4">
                  {historyLoading ? (
                    <p className="text-gray-500 dark:text-gray-400">იტვირთება...</p>
                  ) : history.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400">ისტორია არ არის</p>
                  ) : (
                    <div className="space-y-3">
                      {history.map((entry) => (
                        <div
                          key={entry.id}
                          className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-medium text-gray-800 dark:text-white">
                              {getActionLabel(entry.action)}
                            </span>
                            <span className="text-gray-500 dark:text-gray-400 text-xs">
                              {new Date(entry.created_at).toLocaleString('ka-GE')}
                            </span>
                          </div>
                          <div className="text-gray-600 dark:text-gray-300">
                            {renderHistoryEntry(entry)}
                          </div>
                          {entry.note && (
                            <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm italic">{entry.note}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Collapsible Orders Tab (Placeholder) */}
            <div className="border-t dark:border-gray-700">
              <button
                onClick={() => setOrdersOpen(!ordersOpen)}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <span className="font-medium text-gray-800 dark:text-white">შეკვეთები</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform ${ordersOpen ? 'rotate-180' : ''}`}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              {ordersOpen && (
                <div className="px-6 pb-4">
                  <p className="text-gray-500 dark:text-gray-400">
                    შეკვეთები ჯერ არ არის დაკავშირებული. ეს ფუნქცია მალე დაემატება.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
