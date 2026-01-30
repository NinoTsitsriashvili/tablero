'use client';

import { useState } from 'react';
import { Product } from '@/app/storage/page';

interface ProductFormProps {
  product: Product | null;
  onSave: () => void;
  onCancel: () => void;
}

interface FieldErrors {
  price?: string;
  cost_price?: string;
  quantity?: string;
}

export default function ProductForm({ product, onSave, onCancel }: ProductFormProps) {
  const [formData, setFormData] = useState({
    name: product?.name || '',
    price: product?.price?.toString() || '',
    cost_price: product?.cost_price?.toString() || '',
    quantity: product?.quantity?.toString() || '0',
    description: product?.description || '',
    barcode: product?.barcode || '',
    photo_url: product?.photo_url || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Normalize decimal input: replace comma with dot
  const normalizeDecimal = (value: string): string => {
    return value.replace(',', '.');
  };

  // Validate price field (positive decimal with max 2 decimal places)
  const validatePrice = (value: string, fieldName: string): string | undefined => {
    if (!value) return undefined; // Empty is ok for optional fields
    const normalized = normalizeDecimal(value);
    const num = parseFloat(normalized);
    if (isNaN(num)) {
      return `${fieldName} უნდა იყოს რიცხვი`;
    }
    if (num < 0) {
      return `${fieldName} არ შეიძლება იყოს უარყოფითი`;
    }
    // Check for more than 2 decimal places
    if (normalized.includes('.') && normalized.split('.')[1]?.length > 2) {
      return `${fieldName} მაქსიმუმ 2 ათწილადი`;
    }
    return undefined;
  };

  // Validate quantity field (non-negative integer)
  const validateQuantity = (value: string): string | undefined => {
    if (!value) return undefined;
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return 'რაოდენობა უნდა იყოს მთელი რიცხვი';
    }
    if (num < 0) {
      return 'რაოდენობა არ შეიძლება იყოს უარყოფითი';
    }
    if (value.includes('.') || value.includes(',')) {
      return 'რაოდენობა უნდა იყოს მთელი რიცხვი';
    }
    return undefined;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    // For numeric fields, normalize and validate
    if (name === 'price' || name === 'cost_price') {
      const normalized = normalizeDecimal(value);
      setFormData((prev) => ({ ...prev, [name]: normalized }));

      // Validate on change
      const error = validatePrice(normalized, name === 'price' ? 'ფასი' : 'თვითღირებულება');
      setFieldErrors((prev) => ({ ...prev, [name]: error }));
    } else if (name === 'quantity') {
      // Only allow digits for quantity
      const digitsOnly = value.replace(/[^0-9]/g, '');
      setFormData((prev) => ({ ...prev, [name]: digitsOnly }));

      const error = validateQuantity(digitsOnly);
      setFieldErrors((prev) => ({ ...prev, [name]: error }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate all fields before submission
    const errors: FieldErrors = {};

    // Price is required
    if (!formData.price) {
      errors.price = 'ფასი სავალდებულოა';
    } else {
      const priceError = validatePrice(formData.price, 'ფასი');
      if (priceError) errors.price = priceError;
    }

    // Cost price is optional but must be valid if provided
    if (formData.cost_price) {
      const costPriceError = validatePrice(formData.cost_price, 'თვითღირებულება');
      if (costPriceError) errors.cost_price = costPriceError;
    }

    // Quantity validation
    const quantityError = validateQuantity(formData.quantity || '0');
    if (quantityError) errors.quantity = quantityError;

    // If there are errors, show them and don't submit
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);

    try {
      const url = product ? `/api/products/${product.id}` : '/api/products';
      const method = product ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          price: parseFloat(formData.price),
          cost_price: formData.cost_price ? parseFloat(formData.cost_price) : null,
          quantity: parseInt(formData.quantity, 10) || 0,
          description: formData.description || null,
          barcode: formData.barcode || null,
          photo_url: formData.photo_url || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'პროდუქტის შენახვა ვერ მოხერხდა');
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'შეცდომა მოხდა');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
        {product ? 'პროდუქტის რედაქტირება' : 'ახალი პროდუქტის დამატება'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              დასახელება *
            </label>
            <input
              id="name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700"
              required
            />
          </div>

          <div>
            <label htmlFor="barcode" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              შტრიხკოდი
            </label>
            <input
              id="barcode"
              name="barcode"
              type="text"
              value={formData.barcode}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700"
            />
          </div>

          <div>
            <label htmlFor="price" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              ფასი * <span className="text-gray-400 font-normal">(მაგ: 15.50)</span>
            </label>
            <input
              id="price"
              name="price"
              type="text"
              inputMode="decimal"
              value={formData.price}
              onChange={handleChange}
              placeholder="0.00"
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700 ${
                fieldErrors.price ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              required
            />
            {fieldErrors.price && (
              <p className="text-red-500 dark:text-red-400 text-xs mt-1">{fieldErrors.price}</p>
            )}
          </div>

          <div>
            <label htmlFor="cost_price" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              თვითღირებულება <span className="text-gray-400 font-normal">(მაგ: 10.00)</span>
            </label>
            <input
              id="cost_price"
              name="cost_price"
              type="text"
              inputMode="decimal"
              value={formData.cost_price}
              onChange={handleChange}
              placeholder="0.00"
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700 ${
                fieldErrors.cost_price ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
            />
            {fieldErrors.cost_price && (
              <p className="text-red-500 dark:text-red-400 text-xs mt-1">{fieldErrors.cost_price}</p>
            )}
          </div>

          <div>
            <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              რაოდენობა მარაგში <span className="text-gray-400 font-normal">(მთელი რიცხვი)</span>
            </label>
            <input
              id="quantity"
              name="quantity"
              type="text"
              inputMode="numeric"
              value={formData.quantity}
              onChange={handleChange}
              placeholder="0"
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700 ${
                fieldErrors.quantity ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
            />
            {fieldErrors.quantity && (
              <p className="text-red-500 dark:text-red-400 text-xs mt-1">{fieldErrors.quantity}</p>
            )}
          </div>

          <div>
            <label htmlFor="photo_url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              ფოტოს ბმული
            </label>
            <input
              id="photo_url"
              name="photo_url"
              type="url"
              value={formData.photo_url}
              onChange={handleChange}
              placeholder="https://..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700"
            />
          </div>
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            აღწერა
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            value={formData.description}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700"
          />
        </div>

        {error && <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>}

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            გაუქმება
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'შენახვა...' : product ? 'განახლება' : 'დამატება'}
          </button>
        </div>
      </form>
    </div>
  );
}
