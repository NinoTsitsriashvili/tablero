'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';

interface ExtractedProduct {
  name: string;
  quantity: number;
  matched_product_id?: number;
  matched_product_name?: string;
  unit_price?: number;
}

interface ExtractedOrderData {
  fb_name: string;
  recipient_name: string;
  phone: string;
  phone2: string | null;
  address: string;
  products: ExtractedProduct[];
  payment_type: 'cash' | 'transfer' | null;
  comment: string | null;
  confidence: number;
  missing_fields: string[];
  notes: string | null;
}

interface Product {
  id: number;
  name: string;
  price: number;
  quantity: number;
}

export default function AIOrdersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [conversation, setConversation] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ExtractedOrderData | null>(null);
  const [error, setError] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchProducts();
    }
  }, [session]);

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const handleAnalyze = async () => {
    if (!conversation.trim()) {
      setError('ჩასვით საუბრის ტექსტი');
      return;
    }

    setAnalyzing(true);
    setError('');
    setAnalysisResult(null);

    try {
      const res = await fetch('/api/ai-orders/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation }),
      });

      const data = await res.json();

      if (res.ok) {
        setAnalysisResult(data.data);
      } else {
        setError(data.error || 'ანალიზი ვერ მოხერხდა');
      }
    } catch (error) {
      console.error('Error analyzing:', error);
      setError('შეცდომა მოხდა');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCreateOrder = async () => {
    if (!analysisResult) return;

    // Validate required fields
    if (!analysisResult.fb_name || !analysisResult.phone || !analysisResult.address) {
      setError('შეავსეთ სავალდებულო ველები: FB სახელი, ტელეფონი, მისამართი');
      return;
    }

    if (analysisResult.products.length === 0) {
      setError('აირჩიეთ მინიმუმ ერთი პროდუქტი');
      return;
    }

    // Check if all products are matched
    const unmatchedProducts = analysisResult.products.filter(p => !p.matched_product_id);
    if (unmatchedProducts.length > 0) {
      setError('აირჩიეთ პროდუქტები ყველა ნივთისთვის');
      return;
    }

    setCreating(true);
    setError('');

    try {
      const orderData = {
        fb_name: analysisResult.fb_name,
        recipient_name: analysisResult.recipient_name || analysisResult.fb_name,
        phone: analysisResult.phone,
        phone2: analysisResult.phone2,
        address: analysisResult.address,
        comment: analysisResult.comment,
        payment_type: analysisResult.payment_type || 'cash',
        items: analysisResult.products.map(p => ({
          product_id: p.matched_product_id,
          quantity: p.quantity,
          unit_price: p.unit_price,
          courier_price: 0,
        })),
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/orders/${data.id}`);
      } else {
        const data = await res.json();
        setError(data.error || 'შეკვეთის შექმნა ვერ მოხერხდა');
      }
    } catch (error) {
      console.error('Error creating order:', error);
      setError('შეცდომა მოხდა');
    } finally {
      setCreating(false);
    }
  };

  const handleFieldChange = (field: keyof ExtractedOrderData, value: string) => {
    if (!analysisResult) return;
    setAnalysisResult({ ...analysisResult, [field]: value });
  };

  const handleProductMatch = (index: number, productId: number) => {
    if (!analysisResult) return;
    const product = products.find(p => p.id === productId);
    const updatedProducts = [...analysisResult.products];
    updatedProducts[index] = {
      ...updatedProducts[index],
      matched_product_id: productId,
      matched_product_name: product?.name,
      unit_price: product?.price,
    };
    setAnalysisResult({ ...analysisResult, products: updatedProducts });
  };

  const handleProductQuantityChange = (index: number, quantity: number) => {
    if (!analysisResult) return;
    const updatedProducts = [...analysisResult.products];
    updatedProducts[index] = { ...updatedProducts[index], quantity };
    setAnalysisResult({ ...analysisResult, products: updatedProducts });
  };

  const handleClear = () => {
    setConversation('');
    setAnalysisResult(null);
    setError('');
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 dark:text-green-400';
    if (confidence >= 0.5) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-6"></div>
            <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">AI შეკვეთები</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            ჩასვით Facebook Messenger საუბარი და AI ავტომატურად ამოიღებს შეკვეთის ინფორმაციას
          </p>
        </div>

        {/* Input Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <label htmlFor="conversation" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            საუბრის ტექსტი
          </label>
          <textarea
            id="conversation"
            value={conversation}
            onChange={(e) => setConversation(e.target.value)}
            placeholder="ჩასვით Messenger საუბარი აქ..."
            rows={10}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700 resize-none"
          />
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleAnalyze}
              disabled={analyzing || !conversation.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {analyzing ? 'ანალიზი...' : 'გაანალიზება'}
            </button>
            <button
              onClick={handleClear}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              გასუფთავება
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Analysis Result */}
        {analysisResult && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white">ანალიზის შედეგი</h2>
              <div className={`text-sm font-medium ${getConfidenceColor(analysisResult.confidence)}`}>
                სიზუსტე: {Math.round(analysisResult.confidence * 100)}%
              </div>
            </div>

            {/* Missing Fields Warning */}
            {analysisResult.missing_fields.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4">
                <p className="text-yellow-700 dark:text-yellow-400 text-sm">
                  ვერ მოიძებნა: {analysisResult.missing_fields.join(', ')}
                </p>
              </div>
            )}

            {/* Editable Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  FB სახელი *
                </label>
                <input
                  type="text"
                  value={analysisResult.fb_name}
                  onChange={(e) => handleFieldChange('fb_name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  ადრესატის სახელი
                </label>
                <input
                  type="text"
                  value={analysisResult.recipient_name}
                  onChange={(e) => handleFieldChange('recipient_name', e.target.value)}
                  placeholder={analysisResult.fb_name || 'იგივე რაც FB სახელი'}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  ტელეფონი *
                </label>
                <input
                  type="text"
                  value={analysisResult.phone}
                  onChange={(e) => handleFieldChange('phone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  ტელეფონი 2
                </label>
                <input
                  type="text"
                  value={analysisResult.phone2 || ''}
                  onChange={(e) => handleFieldChange('phone2', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700"
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                მისამართი *
              </label>
              <textarea
                value={analysisResult.address}
                onChange={(e) => handleFieldChange('address', e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700 resize-none"
              />
            </div>

            {/* Products */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                პროდუქტები
              </label>
              {analysisResult.products.map((product, index) => (
                <div key={index} className="flex gap-3 items-center mb-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex-1">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      მოხსენიებული: &quot;{product.name}&quot;
                    </p>
                    <select
                      value={product.matched_product_id || ''}
                      onChange={(e) => handleProductMatch(index, Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-600"
                    >
                      <option value="">აირჩიეთ პროდუქტი</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} - ₾{p.price} (მარაგი: {p.quantity})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-24">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">რაოდენობა</label>
                    <input
                      type="number"
                      min="1"
                      value={product.quantity}
                      onChange={(e) => handleProductQuantityChange(index, Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-600"
                    />
                  </div>
                  {product.unit_price && (
                    <div className="text-right">
                      <p className="text-sm text-gray-500 dark:text-gray-400">ფასი</p>
                      <p className="font-medium text-gray-800 dark:text-white">₾{product.unit_price}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Payment Type */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                გადახდის ტიპი
              </label>
              <select
                value={analysisResult.payment_type || 'cash'}
                onChange={(e) => handleFieldChange('payment_type', e.target.value)}
                className="w-full md:w-48 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700"
              >
                <option value="cash">ხელზე გადახდა</option>
                <option value="transfer">ჩარიცხვა</option>
              </select>
            </div>

            {/* Notes from AI */}
            {analysisResult.notes && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-6">
                <p className="text-blue-700 dark:text-blue-400 text-sm">
                  <strong>AI შენიშვნა:</strong> {analysisResult.notes}
                </p>
              </div>
            )}

            {/* Create Order Button */}
            <div className="flex justify-end gap-3">
              <button
                onClick={handleClear}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                გაუქმება
              </button>
              <button
                onClick={handleCreateOrder}
                disabled={creating}
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {creating ? 'იქმნება...' : 'შეკვეთის შექმნა'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
