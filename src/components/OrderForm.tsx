'use client';

import { useState, useEffect, useRef } from 'react';
import { Product } from '@/app/storage/page';

interface OrderFormProps {
  onSave: () => void;
  onCancel: () => void;
}

export default function OrderForm({ onSave, onCancel }: OrderFormProps) {
  const [formData, setFormData] = useState({
    fb_name: '',
    recipient_name: '',
    phone: '',
    address: '',
    product_id: '',
    product_price: '',
    courier_price: '',
    comment: '',
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    // Filter products based on search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const filtered = products.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          (p.barcode && p.barcode.toLowerCase().includes(query))
      );
      setFilteredProducts(filtered);
    } else {
      setFilteredProducts(products);
    }
  }, [searchQuery, products]);

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
        setFilteredProducts(data);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setFormData((prev) => ({
      ...prev,
      product_id: product.id.toString(),
      product_price: product.price.toString(),
    }));
    setSearchQuery(product.name);
    setShowDropdown(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.fb_name || !formData.recipient_name || !formData.phone || !formData.address || !formData.product_id) {
      setError('შეავსეთ ყველა სავალდებულო ველი');
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
          product_id: parseInt(formData.product_id, 10),
          product_price: parseFloat(formData.product_price),
          courier_price: formData.courier_price ? parseFloat(formData.courier_price) : 0,
          comment: formData.comment || null,
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

  const totalPrice = (parseFloat(formData.product_price) || 0) + (parseFloat(formData.courier_price) || 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
        ახალი შეკვეთა
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* FB Name */}
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

          {/* Recipient Name */}
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

          {/* Phone */}
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

          {/* Address */}
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

          {/* Product Search */}
          <div className="relative" ref={dropdownRef}>
            <label htmlFor="product_search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              პროდუქტი *
            </label>
            <input
              id="product_search"
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
                if (!e.target.value) {
                  setSelectedProduct(null);
                  setFormData((prev) => ({ ...prev, product_id: '', product_price: '' }));
                }
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="მოძებნეთ პროდუქტი..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700"
              required
            />
            {showDropdown && filteredProducts.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleProductSelect(product)}
                    className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 flex justify-between items-center cursor-pointer"
                  >
                    <span className="text-gray-800 dark:text-white">{product.name}</span>
                    <span className="text-gray-500 dark:text-gray-400 text-sm">₾{Number(product.price).toFixed(2)}</span>
                  </button>
                ))}
              </div>
            )}
            {showDropdown && searchQuery && filteredProducts.length === 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg p-3 text-gray-500 dark:text-gray-400">
                პროდუქტი ვერ მოიძებნა
              </div>
            )}
          </div>

          {/* Product Price (readonly) */}
          <div>
            <label htmlFor="product_price" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              პროდუქტის ფასი
            </label>
            <input
              id="product_price"
              name="product_price"
              type="text"
              value={formData.product_price ? `₾${Number(formData.product_price).toFixed(2)}` : ''}
              readOnly
              placeholder="აირჩიეთ პროდუქტი"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-600 text-gray-900 dark:text-white cursor-not-allowed"
            />
          </div>

          {/* Courier Price */}
          <div>
            <label htmlFor="courier_price" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              კურიერის ფასი
            </label>
            <input
              id="courier_price"
              name="courier_price"
              type="number"
              step="0.01"
              min="0"
              value={formData.courier_price}
              onChange={handleChange}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700"
            />
          </div>

          {/* Total Price Display */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              ჯამი
            </label>
            <div className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-bold">
              ₾{totalPrice.toFixed(2)}
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
