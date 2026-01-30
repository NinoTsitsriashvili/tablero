'use client';

import { useState, useEffect, useRef } from 'react';
import { Product } from '@/app/storage/page';

interface OrderFormProps {
  onSave: () => void;
  onCancel: () => void;
}

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  unit_price: string;
  quantity: string;
  courier_price: string;
  searchQuery: string;
  showDropdown: boolean;
}

export default function OrderForm({ onSave, onCancel }: OrderFormProps) {
  const [formData, setFormData] = useState({
    fb_name: '',
    recipient_name: '',
    phone: '',
    address: '',
    comment: '',
  });

  const [orderItems, setOrderItems] = useState<OrderItem[]>([
    {
      id: crypto.randomUUID(),
      product_id: '',
      product_name: '',
      unit_price: '',
      quantity: '1',
      courier_price: '',
      searchQuery: '',
      showDropdown: false,
    },
  ]);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      setOrderItems((prev) =>
        prev.map((item) => {
          const ref = dropdownRefs.current[item.id];
          if (ref && !ref.contains(event.target as Node)) {
            return { ...item, showDropdown: false };
          }
          return item;
        })
      );
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const getFilteredProducts = (searchQuery: string) => {
    if (!searchQuery.trim()) return products;
    const query = searchQuery.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        (p.barcode && p.barcode.toLowerCase().includes(query))
    );
  };

  const handleProductSelect = (itemId: string, product: Product) => {
    setOrderItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              product_id: product.id.toString(),
              product_name: product.name,
              unit_price: product.price.toString(),
              searchQuery: product.name,
              showDropdown: false,
            }
          : item
      )
    );
  };

  const handleItemChange = (itemId: string, field: keyof OrderItem, value: string) => {
    setOrderItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item
      )
    );
  };

  const handleSearchChange = (itemId: string, value: string) => {
    setOrderItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              searchQuery: value,
              showDropdown: true,
              ...(value === '' ? { product_id: '', product_name: '', unit_price: '' } : {}),
            }
          : item
      )
    );
  };

  const addOrderItem = () => {
    setOrderItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        product_id: '',
        product_name: '',
        unit_price: '',
        quantity: '1',
        courier_price: '',
        searchQuery: '',
        showDropdown: false,
      },
    ]);
  };

  const removeOrderItem = (itemId: string) => {
    if (orderItems.length > 1) {
      setOrderItems((prev) => prev.filter((item) => item.id !== itemId));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.fb_name || !formData.recipient_name || !formData.phone || !formData.address) {
      setError('შეავსეთ ყველა სავალდებულო ველი');
      return;
    }

    const validItems = orderItems.filter((item) => item.product_id);
    if (validItems.length === 0) {
      setError('დაამატეთ მინიმუმ ერთი პროდუქტი');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fb_name: formData.fb_name,
          recipient_name: formData.recipient_name,
          phone: formData.phone,
          address: formData.address,
          comment: formData.comment || null,
          items: validItems.map((item) => ({
            product_id: parseInt(item.product_id, 10),
            unit_price: parseFloat(item.unit_price),
            quantity: parseInt(item.quantity, 10) || 1,
            courier_price: item.courier_price ? parseFloat(item.courier_price) : 0,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'შეცდომა მოხდა');
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'შეცდომა მოხდა');
    } finally {
      setLoading(false);
    }
  };

  const calculateItemTotal = (item: OrderItem) => {
    const price = parseFloat(item.unit_price) || 0;
    const qty = parseInt(item.quantity, 10) || 0;
    const courier = parseFloat(item.courier_price) || 0;
    return price * qty + courier;
  };

  const totalPrice = orderItems.reduce((sum, item) => sum + calculateItemTotal(item), 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
        ახალი შეკვეთა
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Customer Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="fb_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              FB სახელი *
            </label>
            <input
              id="fb_name"
              name="fb_name"
              type="text"
              value={formData.fb_name}
              onChange={handleChange}
              placeholder="Facebook-ის სახელი"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700"
              required
            />
          </div>

          <div>
            <label htmlFor="recipient_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              ადრესატის სახელი *
            </label>
            <input
              id="recipient_name"
              name="recipient_name"
              type="text"
              value={formData.recipient_name}
              onChange={handleChange}
              placeholder="მიმღების სრული სახელი"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700"
              required
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              ტელეფონი *
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleChange}
              placeholder="599 XX XX XX"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700"
              required
            />
          </div>

          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              მისამართი *
            </label>
            <input
              id="address"
              name="address"
              type="text"
              value={formData.address}
              onChange={handleChange}
              placeholder="მიწოდების მისამართი"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700"
              required
            />
          </div>
        </div>

        {/* Products Section */}
        <div className="border-t dark:border-gray-700 pt-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-md font-medium text-gray-800 dark:text-white">პროდუქტები</h3>
            <button
              type="button"
              onClick={addOrderItem}
              className="px-3 py-1.5 text-sm bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-md hover:bg-green-200 dark:hover:bg-green-800 transition-colors cursor-pointer"
            >
              + დამატება
            </button>
          </div>

          <div className="space-y-4">
            {orderItems.map((item, index) => (
              <div
                key={item.id}
                className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4"
              >
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    პროდუქტი #{index + 1}
                  </span>
                  {orderItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeOrderItem(item.id)}
                      className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 cursor-pointer"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {/* Product Search */}
                  <div
                    className="relative md:col-span-2"
                    ref={(el) => { dropdownRefs.current[item.id] = el; }}
                  >
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      პროდუქტი *
                    </label>
                    <input
                      type="text"
                      value={item.searchQuery}
                      onChange={(e) => handleSearchChange(item.id, e.target.value)}
                      onFocus={() => handleItemChange(item.id, 'showDropdown', 'true')}
                      placeholder="მოძებნეთ პროდუქტი..."
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-600"
                    />
                    {item.showDropdown && getFilteredProducts(item.searchQuery).length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {getFilteredProducts(item.searchQuery).map((product) => (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => handleProductSelect(item.id, product)}
                            className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-500 flex justify-between items-center cursor-pointer"
                          >
                            <span className="text-gray-800 dark:text-white">{product.name}</span>
                            <span className="text-gray-500 dark:text-gray-300 text-sm">₾{Number(product.price).toFixed(2)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Quantity */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      რაოდენობა
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-600"
                    />
                  </div>

                  {/* Unit Price (readonly) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      ფასი
                    </label>
                    <input
                      type="text"
                      value={item.unit_price ? `₾${Number(item.unit_price).toFixed(2)}` : ''}
                      readOnly
                      placeholder="--"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-100 dark:bg-gray-500 text-gray-900 dark:text-white cursor-not-allowed"
                    />
                  </div>

                  {/* Courier Price */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      კურიერი
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.courier_price}
                      onChange={(e) => handleItemChange(item.id, 'courier_price', e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-600"
                    />
                  </div>

                  {/* Item Subtotal */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      ქვეჯამი
                    </label>
                    <div className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium">
                      ₾{calculateItemTotal(item).toFixed(2)}
                      {item.unit_price && parseInt(item.quantity) > 1 && (
                        <span className="text-xs ml-2 text-gray-500 dark:text-gray-400">
                          ({item.quantity} × ₾{Number(item.unit_price).toFixed(2)}{item.courier_price ? ` + ₾${Number(item.courier_price).toFixed(2)}` : ''})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Total */}
        <div className="border-t dark:border-gray-700 pt-4">
          <div className="flex justify-end">
            <div className="w-full md:w-64">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                სულ ჯამი
              </label>
              <div className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-md bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-bold text-xl">
                ₾{totalPrice.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Comment */}
        <div>
          <label htmlFor="comment" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            კომენტარი
          </label>
          <textarea
            id="comment"
            name="comment"
            value={formData.comment}
            onChange={handleChange}
            placeholder="დამატებითი ინფორმაცია..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700 resize-none"
          />
        </div>

        {error && (
          <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>
        )}

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors cursor-pointer"
          >
            გაუქმება
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {loading ? 'შენახვა...' : 'დამატება'}
          </button>
        </div>
      </form>
    </div>
  );
}
