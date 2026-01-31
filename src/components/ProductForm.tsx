'use client';

import { useState, useEffect, useCallback } from 'react';
import { Product } from '@/app/storage/page';

interface ProductFormProps {
  product: Product | null;
  onSave: () => void;
  onCancel: () => void;
}

interface FieldErrors {
  name?: string;
  price?: string;
  cost_price?: string;
  quantity?: string;
  barcode?: string;
  description?: string;
  photo_url?: string;
}

// Validation constants
const VALIDATION_LIMITS = {
  NAME_MIN: 2,
  NAME_MAX: 255,
  PRICE_MAX: 99999.99,
  QUANTITY_MAX: 99999,
  BARCODE_MAX: 50,
  DESCRIPTION_MAX: 2000,
};

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
  const [warningMessage, setWarningMessage] = useState('');

  // Auto-hide warning after 3 seconds
  useEffect(() => {
    if (warningMessage) {
      const timer = setTimeout(() => setWarningMessage(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [warningMessage]);

  const showWarning = useCallback((message: string) => {
    setWarningMessage(message);
  }, []);

  // Normalize decimal input: replace comma with dot
  const normalizeDecimal = (value: string): string => {
    return value.replace(',', '.');
  };

  // Validate name field
  const validateName = (value: string): string | undefined => {
    if (!value || value.trim().length === 0) {
      return 'დასახელება სავალდებულოა';
    }
    if (value.trim().length < VALIDATION_LIMITS.NAME_MIN) {
      return `დასახელება მინიმუმ ${VALIDATION_LIMITS.NAME_MIN} სიმბოლო`;
    }
    if (value.length > VALIDATION_LIMITS.NAME_MAX) {
      return `დასახელება მაქსიმუმ ${VALIDATION_LIMITS.NAME_MAX} სიმბოლო`;
    }
    return undefined;
  };

  // Validate price field (positive decimal with max 2 decimal places)
  const validatePrice = (value: string, fieldName: string, isRequired: boolean = false): string | undefined => {
    if (!value) {
      return isRequired ? `${fieldName} სავალდებულოა` : undefined;
    }
    const normalized = normalizeDecimal(value);
    const num = parseFloat(normalized);
    if (isNaN(num)) {
      return `${fieldName} უნდა იყოს რიცხვი`;
    }
    if (num < 0) {
      return `${fieldName} არ შეიძლება იყოს უარყოფითი`;
    }
    if (num > VALIDATION_LIMITS.PRICE_MAX) {
      return `${fieldName} მაქსიმუმ ${VALIDATION_LIMITS.PRICE_MAX}`;
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
    if (num > VALIDATION_LIMITS.QUANTITY_MAX) {
      return `რაოდენობა მაქსიმუმ ${VALIDATION_LIMITS.QUANTITY_MAX}`;
    }
    if (value.includes('.') || value.includes(',')) {
      return 'რაოდენობა უნდა იყოს მთელი რიცხვი';
    }
    return undefined;
  };

  // Validate barcode field
  const validateBarcode = (value: string): string | undefined => {
    if (!value) return undefined;
    if (value.length > VALIDATION_LIMITS.BARCODE_MAX) {
      return `შტრიხკოდი მაქსიმუმ ${VALIDATION_LIMITS.BARCODE_MAX} სიმბოლო`;
    }
    return undefined;
  };

  // Validate description field
  const validateDescription = (value: string): string | undefined => {
    if (!value) return undefined;
    if (value.length > VALIDATION_LIMITS.DESCRIPTION_MAX) {
      return `აღწერა მაქსიმუმ ${VALIDATION_LIMITS.DESCRIPTION_MAX} სიმბოლო`;
    }
    return undefined;
  };

  // Validate URL field
  const validateUrl = (value: string): string | undefined => {
    if (!value) return undefined;
    try {
      new URL(value);
      return undefined;
    } catch {
      return 'არასწორი URL ფორმატი';
    }
  };

  // Validate cost_price vs price relationship
  const validateCostPriceRelation = (costPrice: string, price: string): string | undefined => {
    if (!costPrice || !price) return undefined;
    const cost = parseFloat(normalizeDecimal(costPrice));
    const sell = parseFloat(normalizeDecimal(price));
    if (!isNaN(cost) && !isNaN(sell) && cost >= sell) {
      return 'თვითღირებულება უნდა იყოს ფასზე ნაკლები';
    }
    return undefined;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    // For numeric fields, normalize and validate
    if (name === 'price' || name === 'cost_price') {
      // Check if user entered invalid characters (letters or symbols other than digits, dot, comma)
      const invalidChars = value.replace(/[0-9.,]/g, '');
      if (invalidChars.length > 0) {
        const fieldLabel = name === 'price' ? 'ფასი' : 'თვითღირებულება';
        showWarning(`${fieldLabel}: მხოლოდ რიცხვები დაშვებულია!`);
        setFieldErrors((prev) => ({
          ...prev,
          [name]: 'მხოლოდ რიცხვები დაშვებულია'
        }));
        return; // Don't update the value
      }

      const normalized = normalizeDecimal(value);
      setFormData((prev) => ({ ...prev, [name]: normalized }));

      // Validate on change
      const error = validatePrice(normalized, name === 'price' ? 'ფასი' : 'თვითღირებულება');
      setFieldErrors((prev) => ({ ...prev, [name]: error }));
    } else if (name === 'quantity') {
      // Check if user tried to enter non-digit characters
      const invalidChars = value.replace(/[0-9]/g, '');
      if (invalidChars.length > 0) {
        showWarning('რაოდენობა: მხოლოდ მთელი რიცხვები დაშვებულია!');
        setFieldErrors((prev) => ({
          ...prev,
          quantity: 'მხოლოდ მთელი რიცხვები დაშვებულია'
        }));
      }

      // Only allow digits for quantity
      const digitsOnly = value.replace(/[^0-9]/g, '');
      setFormData((prev) => ({ ...prev, [name]: digitsOnly }));

      // Clear error if valid input
      if (digitsOnly === value) {
        const error = validateQuantity(digitsOnly);
        setFieldErrors((prev) => ({ ...prev, [name]: error }));
      }
    } else if (name === 'name') {
      setFormData((prev) => ({ ...prev, [name]: value }));
      const error = validateName(value);
      setFieldErrors((prev) => ({ ...prev, name: error }));
    } else if (name === 'barcode') {
      setFormData((prev) => ({ ...prev, [name]: value }));
      const error = validateBarcode(value);
      setFieldErrors((prev) => ({ ...prev, barcode: error }));
    } else if (name === 'description') {
      setFormData((prev) => ({ ...prev, [name]: value }));
      const error = validateDescription(value);
      setFieldErrors((prev) => ({ ...prev, description: error }));
    } else if (name === 'photo_url') {
      setFormData((prev) => ({ ...prev, [name]: value }));
      const error = validateUrl(value);
      setFieldErrors((prev) => ({ ...prev, photo_url: error }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate all fields before submission
    const errors: FieldErrors = {};

    // Name validation (required)
    const nameError = validateName(formData.name);
    if (nameError) errors.name = nameError;

    // Price is required
    const priceError = validatePrice(formData.price, 'ფასი', true);
    if (priceError) errors.price = priceError;

    // Cost price is optional but must be valid if provided
    if (formData.cost_price) {
      const costPriceError = validatePrice(formData.cost_price, 'თვითღირებულება');
      if (costPriceError) errors.cost_price = costPriceError;

      // Check cost_price < price
      const relationError = validateCostPriceRelation(formData.cost_price, formData.price);
      if (relationError && !errors.cost_price) errors.cost_price = relationError;
    }

    // Quantity validation
    const quantityError = validateQuantity(formData.quantity || '0');
    if (quantityError) errors.quantity = quantityError;

    // Barcode validation
    const barcodeError = validateBarcode(formData.barcode);
    if (barcodeError) errors.barcode = barcodeError;

    // Description validation
    const descriptionError = validateDescription(formData.description);
    if (descriptionError) errors.description = descriptionError;

    // Photo URL validation
    if (formData.photo_url) {
      const urlError = validateUrl(formData.photo_url);
      if (urlError) errors.photo_url = urlError;
    }

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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 relative">
      {/* Warning popup */}
      {warningMessage && (
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-10 animate-pulse">
          <div className="bg-yellow-100 dark:bg-yellow-900 border border-yellow-400 dark:border-yellow-600 text-yellow-800 dark:text-yellow-200 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <span className="font-medium">{warningMessage}</span>
            <button
              type="button"
              onClick={() => setWarningMessage('')}
              className="ml-2 text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-200"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
        {product ? 'პროდუქტის რედაქტირება' : 'ახალი პროდუქტის დამატება'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              დასახელება * <span className="text-gray-400 font-normal">({formData.name.length}/{VALIDATION_LIMITS.NAME_MAX})</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleChange}
              maxLength={VALIDATION_LIMITS.NAME_MAX}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700 ${
                fieldErrors.name ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              required
            />
            {fieldErrors.name && (
              <p className="text-red-500 dark:text-red-400 text-xs mt-1">{fieldErrors.name}</p>
            )}
          </div>

          <div>
            <label htmlFor="barcode" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              შტრიხკოდი <span className="text-gray-400 font-normal">(მაქს. {VALIDATION_LIMITS.BARCODE_MAX})</span>
            </label>
            <input
              id="barcode"
              name="barcode"
              type="text"
              value={formData.barcode}
              onChange={handleChange}
              maxLength={VALIDATION_LIMITS.BARCODE_MAX}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700 ${
                fieldErrors.barcode ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
            />
            {fieldErrors.barcode && (
              <p className="text-red-500 dark:text-red-400 text-xs mt-1">{fieldErrors.barcode}</p>
            )}
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
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700 ${
                fieldErrors.photo_url ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
            />
            {fieldErrors.photo_url && (
              <p className="text-red-500 dark:text-red-400 text-xs mt-1">{fieldErrors.photo_url}</p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            აღწერა <span className="text-gray-400 font-normal">({formData.description.length}/{VALIDATION_LIMITS.DESCRIPTION_MAX})</span>
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            value={formData.description}
            onChange={handleChange}
            maxLength={VALIDATION_LIMITS.DESCRIPTION_MAX}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700 ${
              fieldErrors.description ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
            }`}
          />
          {fieldErrors.description && (
            <p className="text-red-500 dark:text-red-400 text-xs mt-1">{fieldErrors.description}</p>
          )}
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
