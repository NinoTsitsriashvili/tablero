'use client';

import { useState, useEffect, use } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Navbar from '@/components/Navbar';
import ProductForm from '@/components/ProductForm';
import { Product } from '../page';

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session, status } = useSession();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditForm, setShowEditForm] = useState(false);
  const [error, setError] = useState('');

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
              <div className="relative h-64 w-full bg-gray-100 dark:bg-gray-700">
                <Image
                  src={product.photo_url}
                  alt={product.name}
                  fill
                  className="object-contain"
                  sizes="(max-width: 896px) 100vw, 896px"
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

                {costPrice !== null && (
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">თვითღირებულება</p>
                    <p className="text-xl font-bold text-gray-800 dark:text-white">₾{costPrice.toFixed(2)}</p>
                  </div>
                )}

                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">მარაგი</p>
                  <p className={`text-xl font-bold ${product.quantity > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {product.quantity}
                  </p>
                </div>

                {profit !== null && (
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">მოგება</p>
                    <p className={`text-xl font-bold ${profit > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      ₾{profit.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>

              {product.barcode && (
                <div className="mb-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">შტრიხკოდი</p>
                  <p className="text-gray-800 dark:text-gray-300 font-mono">{product.barcode}</p>
                </div>
              )}

              {product.description && (
                <div className="mb-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">აღწერა</p>
                  <p className="text-gray-800 dark:text-gray-300 whitespace-pre-wrap">{product.description}</p>
                </div>
              )}

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
          </div>
        )}
      </main>
    </div>
  );
}
