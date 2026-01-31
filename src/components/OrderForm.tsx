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

interface FieldErrors {
  fb_name?: string;
  recipient_name?: string;
  phone?: string;
  address?: string;
  comment?: string;
  items?: string;
}

// Validation constants
const VALIDATION_LIMITS = {
  NAME_MIN: 2,
  NAME_MAX: 255,
  PHONE_MIN: 9,
  PHONE_MAX: 15,
  ADDRESS_MIN: 5,
  ADDRESS_MAX: 500,
  COMMENT_MAX: 1000,
  QUANTITY_MAX: 999,
  COURIER_PRICE_MAX: 999.99,
};

// Georgian phone pattern: starts with 5 and has 9 digits, or with +995 prefix
const GEORGIAN_PHONE_REGEX = /^(\+995\s?)?5\d{8}$/;

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
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Validation functions
  const validateName = (value: string, fieldLabel: string): string | undefined => {
    if (!value || value.trim().length === 0) {
      return `${fieldLabel} სავალდებულოა`;
    }
    if (value.trim().length < VALIDATION_LIMITS.NAME_MIN) {
      return `${fieldLabel} მინიმუმ ${VALIDATION_LIMITS.NAME_MIN} სიმბოლო`;
    }
    if (value.length > VALIDATION_LIMITS.NAME_MAX) {
      return `${fieldLabel} მაქსიმუმ ${VALIDATION_LIMITS.NAME_MAX} სიმბოლო`;
    }
    return undefined;
  };

  const validatePhone = (value: string): string | undefined => {
    if (!value || value.trim().length === 0) {
      return 'ტელეფონი სავალდებულოა';
    }
    // Remove spaces for validation
    const cleanPhone = value.replace(/\s/g, '');
    if (cleanPhone.length < VALIDATION_LIMITS.PHONE_MIN) {
      return `ტელეფონი მინიმუმ ${VALIDATION_LIMITS.PHONE_MIN} ციფრი`;
    }
    if (cleanPhone.length > VALIDATION_LIMITS.PHONE_MAX) {
      return `ტელეფონი მაქსიმუმ ${VALIDATION_LIMITS.PHONE_MAX} სიმბოლო`;
    }
    if (!GEORGIAN_PHONE_REGEX.test(cleanPhone)) {
      return 'არასწორი ფორმატი (მაგ: 5XXXXXXXX)';
    }
    return undefined;
  };

  const validateAddress = (value: string): string | undefined => {
    if (!value || value.trim().length === 0) {
      return 'მისამართი სავალდებულოა';
    }
    if (value.trim().length < VALIDATION_LIMITS.ADDRESS_MIN) {
      return `მისამართი მინიმუმ ${VALIDATION_LIMITS.ADDRESS_MIN} სიმბოლო`;
    }
    if (value.length > VALIDATION_LIMITS.ADDRESS_MAX) {
      return `მისამართი მაქსიმუმ ${VALIDATION_LIMITS.ADDRESS_MAX} სიმბოლო`;
    }
    return undefined;
  };

  const validateComment = (value: string): string | undefined => {
    if (!value) return undefined;
    if (value.length > VALIDATION_LIMITS.COMMENT_MAX) {
      return `კომენტარი მაქსიმუმ ${VALIDATION_LIMITS.COMMENT_MAX} სიმბოლო`;
    }
    return undefined;
  };

  const validateQuantity = (value: string): boolean => {
    const num = parseInt(value, 10);
    return !isNaN(num) && num >= 1 && num <= VALIDATION_LIMITS.QUANTITY_MAX;
  };

  const validateCourierPrice = (value: string): boolean => {
    if (!value) return true;
    const num = parseFloat(value);
    return !isNaN(num) && num >= 0 && num <= VALIDATION_LIMITS.COURIER_PRICE_MAX;
  };

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
    // Validate quantity - only allow positive integers up to max
    if (field === 'quantity') {
      // Remove any non-digit characters
      const digitsOnly = value.replace(/[^0-9]/g, '');
      const num = parseInt(digitsOnly, 10);
      // Limit to max quantity
      if (num > VALIDATION_LIMITS.QUANTITY_MAX) {
        return;
      }
      setOrderItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, [field]: digitsOnly || '1' } : item
        )
      );
      return;
    }

    // Validate courier_price - only allow positive decimals up to max
    if (field === 'courier_price') {
      const num = parseFloat(value);
      if (!isNaN(num) && num > VALIDATION_LIMITS.COURIER_PRICE_MAX) {
        return;
      }
    }

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

    // Validate on change
    let error: string | undefined;
    switch (name) {
      case 'fb_name':
        error = validateName(value, 'FB სახელი');
        break;
      case 'recipient_name':
        error = validateName(value, 'ადრესატის სახელი');
        break;
      case 'phone':
        error = validatePhone(value);
        break;
      case 'address':
        error = validateAddress(value);
        break;
      case 'comment':
        error = validateComment(value);
        break;
    }
    setFieldErrors((prev) => ({ ...prev, [name]: error }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate all fields
    const errors: FieldErrors = {};

    const fbNameError = validateName(formData.fb_name, 'FB სახელი');
    if (fbNameError) errors.fb_name = fbNameError;

    const recipientNameError = validateName(formData.recipient_name, 'ადრესატის სახელი');
    if (recipientNameError) errors.recipient_name = recipientNameError;

    const phoneError = validatePhone(formData.phone);
    if (phoneError) errors.phone = phoneError;

    const addressError = validateAddress(formData.address);
    if (addressError) errors.address = addressError;

    const commentError = validateComment(formData.comment);
    if (commentError) errors.comment = commentError;

    // Validate items
    const validItems = orderItems.filter((item) => item.product_id);
    if (validItems.length === 0) {
      errors.items = 'დაამატეთ მინიმუმ ერთი პროდუქტი';
    } else {
      // Check for duplicate products
      const productIds = validItems.map((item) => item.product_id);
      const hasDuplicates = productIds.length !== new Set(productIds).size;
      if (hasDuplicates) {
        errors.items = 'ერთი პროდუქტი მხოლოდ ერთხელ შეიძლება დაემატოს';
      }

      // Validate each item's quantity and courier price
      for (const item of validItems) {
        if (!validateQuantity(item.quantity)) {
          errors.items = `რაოდენობა უნდა იყოს 1-დან ${VALIDATION_LIMITS.QUANTITY_MAX}-მდე`;
          break;
        }
        if (!validateCourierPrice(item.courier_price)) {
          errors.items = `კურიერის ფასი მაქსიმუმ ${VALIDATION_LIMITS.COURIER_PRICE_MAX}`;
          break;
        }
      }
    }

    // If there are errors, show them and don't submit
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      if (errors.items) {
        setError(errors.items);
      }
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
              FB სახელი * <span className="text-gray-400 font-normal">({formData.fb_name.length}/{VALIDATION_LIMITS.NAME_MAX})</span>
            </label>
            <input
              id="fb_name"
              name="fb_name"
              type="text"
              value={formData.fb_name}
              onChange={handleChange}
              maxLength={VALIDATION_LIMITS.NAME_MAX}
              placeholder="Facebook-ის სახელი"
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700 ${
                fieldErrors.fb_name ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              required
            />
            {fieldErrors.fb_name && (
              <p className="text-red-500 dark:text-red-400 text-xs mt-1">{fieldErrors.fb_name}</p>
            )}
          </div>

          <div>
            <label htmlFor="recipient_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              ადრესატის სახელი * <span className="text-gray-400 font-normal">({formData.recipient_name.length}/{VALIDATION_LIMITS.NAME_MAX})</span>
            </label>
            <input
              id="recipient_name"
              name="recipient_name"
              type="text"
              value={formData.recipient_name}
              onChange={handleChange}
              maxLength={VALIDATION_LIMITS.NAME_MAX}
              placeholder="მიმღების სრული სახელი"
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700 ${
                fieldErrors.recipient_name ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              required
            />
            {fieldErrors.recipient_name && (
              <p className="text-red-500 dark:text-red-400 text-xs mt-1">{fieldErrors.recipient_name}</p>
            )}
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              ტელეფონი * <span className="text-gray-400 font-normal">(5XXXXXXXX)</span>
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleChange}
              maxLength={VALIDATION_LIMITS.PHONE_MAX}
              placeholder="5XX XXX XXX"
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700 ${
                fieldErrors.phone ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              required
            />
            {fieldErrors.phone && (
              <p className="text-red-500 dark:text-red-400 text-xs mt-1">{fieldErrors.phone}</p>
            )}
          </div>

          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              მისამართი * <span className="text-gray-400 font-normal">({formData.address.length}/{VALIDATION_LIMITS.ADDRESS_MAX})</span>
            </label>
            <input
              id="address"
              name="address"
              type="text"
              value={formData.address}
              onChange={handleChange}
              maxLength={VALIDATION_LIMITS.ADDRESS_MAX}
              placeholder="მიწოდების მისამართი"
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700 ${
                fieldErrors.address ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              required
            />
            {fieldErrors.address && (
              <p className="text-red-500 dark:text-red-400 text-xs mt-1">{fieldErrors.address}</p>
            )}
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
            კომენტარი <span className="text-gray-400 font-normal">({formData.comment.length}/{VALIDATION_LIMITS.COMMENT_MAX})</span>
          </label>
          <textarea
            id="comment"
            name="comment"
            value={formData.comment}
            onChange={handleChange}
            maxLength={VALIDATION_LIMITS.COMMENT_MAX}
            placeholder="დამატებითი ინფორმაცია..."
            rows={3}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700 resize-none ${
              fieldErrors.comment ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
            }`}
          />
          {fieldErrors.comment && (
            <p className="text-red-500 dark:text-red-400 text-xs mt-1">{fieldErrors.comment}</p>
          )}
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
