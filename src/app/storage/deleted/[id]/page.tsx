'use client';

import { useState, useEffect, use } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Navbar from '@/components/Navbar';
import { Product } from '../../page';

export default function DeletedProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session, status } = useSession();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
      const res = await fetch(`/api/products/deleted/${id}`);
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

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const res = await fetch(`/api/products/${id}/restore`, {
        method: 'POST',
      });

      if (res.ok) {
        router.push(`/storage/${id}`);
      } else {
        const data = await res.json();
        setError(data.error || 'აღდგენა ვერ მოხერხდა');
      }
    } catch (error) {
      console.error('Error restoring product:', error);
      setError('შეცდომა მოხდა');
    } finally {
      setRestoring(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (!confirm('ნამდვილად გსურთ პროდუქტის სამუდამოდ წაშლა? ეს მოქმედება შეუქცევადია!')) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/products/${id}/permanent`, {
        method: 'DELETE',
      });

      if (res.ok) {
        router.push('/storage');
      } else {
        const data = await res.json();
        setError(data.error || 'წაშლა ვერ მოხერხდა');
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      setError('შეცდომა მოხდა');
    } finally {
      setDeleting(false);
    }
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined || value === '') {
      return '--';
    }
    return String(value);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="mb-6">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-40 animate-pulse"></div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden animate-pulse">
            <div className="h-64 bg-gray-200 dark:bg-gray-700"></div>
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-2"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                </div>
                <div className="flex gap-2">
                  <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-28"></div>
                  <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-28"></div>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-16 mb-2"></div>
                    <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-20"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
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

        {/* Deleted Banner */}
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-red-600 dark:text-red-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
            <div>
              <p className="font-medium text-red-800 dark:text-red-300">ეს პროდუქტი წაშლილია</p>
              <p className="text-sm text-red-600 dark:text-red-400">
                წაშლილია: {product.deleted_at ? new Date(product.deleted_at).toLocaleString('ka-GE') : '--'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden opacity-90">
          {product.photo_url && (
            <div className="relative w-full h-64 bg-gray-100 dark:bg-gray-700">
              <Image
                src={product.photo_url}
                alt={product.name}
                fill
                sizes="(max-width: 768px) 100vw, 768px"
                className="object-contain"
                priority
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
                  onClick={handleRestore}
                  disabled={restoring || deleting}
                  className="px-4 py-2 text-sm bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-md hover:bg-green-200 dark:hover:bg-green-800 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {restoring ? 'აღდგენა...' : 'აღდგენა'}
                </button>
                <button
                  onClick={handlePermanentDelete}
                  disabled={restoring || deleting}
                  className="px-4 py-2 text-sm bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-md hover:bg-red-200 dark:hover:bg-red-800 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {deleting ? 'წაშლა...' : 'სამუდამოდ წაშლა'}
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
              <p className="text-gray-800 dark:text-gray-300 font-mono">{formatValue(product.barcode)}</p>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">აღწერა</p>
              <p className="text-gray-800 dark:text-gray-300 whitespace-pre-wrap">{formatValue(product.description)}</p>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">ფოტოს ბმული</p>
              {product.photo_url ? (
                <a
                  href={product.photo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline text-sm break-all"
                >
                  {product.photo_url}
                </a>
              ) : (
                <p className="text-gray-800 dark:text-gray-300">--</p>
              )}
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
                  <span>წაშლილია: </span>
                  <span className="text-gray-800 dark:text-gray-300">
                    {product.deleted_at ? new Date(product.deleted_at).toLocaleDateString('ka-GE') : '--'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
