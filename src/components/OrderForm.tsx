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
  subtotal: string; // Editable subtotal (empty means auto-calculate)
  searchQuery: string;
  showDropdown: boolean;
}

interface FieldErrors {
  fb_name?: string;
  recipient_name?: string;
  phone?: string;
  phone2?: string;
  address?: string;
  comment?: string;
  send_date?: string;
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
    phone2: '',
    address: '',
    comment: '',
    payment_type: 'cash',
    send_date: '',
    location: 'tbilisi',
    added_by: 'ani',
  });

  const [orderItems, setOrderItems] = useState<OrderItem[]>([
    {
      id: crypto.randomUUID(),
      product_id: '',
      product_name: '',
      unit_price: '',
      quantity: '1',
      courier_price: '',
      subtotal: '',
      searchQuery: '',
      showDropdown: false,
    },
  ]);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const errorRef = useRef<HTMLDivElement>(null);

  // Show modal when error occurs and scroll to it
  useEffect(() => {
    if (error) {
      setShowErrorModal(true);
      // Scroll to error on mobile
      errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Vibrate on mobile if supported
      if (navigator.vibrate) {
        navigator.vibrate(200);
      }
    }
  }, [error]);


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

  const validatePhone = (value: string, required: boolean = true): string | undefined => {
    if (!value || value.trim().length === 0) {
      return required ? 'ტელეფონი სავალდებულოა' : undefined;
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
    if (!value || value.trim() === '') return false;
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

  // Format price: no decimals if whole number
  const formatPrice = (price: number): string => {
    if (Number.isInteger(price)) {
      return price.toString();
    }
    return price.toFixed(2).replace(/\.?0+$/, '');
  };

  const handleProductSelect = (itemId: string, product: Product) => {
    setOrderItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              product_id: product.id.toString(),
              product_name: product.name,
              unit_price: formatPrice(Number(product.price)),
              subtotal: '', // Reset subtotal to auto-calculate
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
      if (!isNaN(num) && num > VALIDATION_LIMITS.QUANTITY_MAX) {
        return;
      }
      setOrderItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, [field]: digitsOnly, subtotal: '' } : item
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
      setOrderItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, [field]: value, subtotal: '' } : item
        )
      );
      return;
    }

    // Validate unit_price - only allow valid numbers
    if (field === 'unit_price') {
      // Allow empty or valid number format
      if (value !== '' && isNaN(parseFloat(value))) {
        return;
      }
      setOrderItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, [field]: value, subtotal: '' } : item
        )
      );
      return;
    }

    // For subtotal, don't reset itself
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

  // Handle focus on product search - clear text to allow new search
  const handleProductFocus = (itemId: string) => {
    setOrderItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, searchQuery: '', showDropdown: true }
          : item
      )
    );
  };

  // Handle blur on product search - restore product name if no change was made
  const handleProductBlur = (itemId: string) => {
    // Small delay to allow click on dropdown item to register first
    setTimeout(() => {
      setOrderItems((prev) =>
        prev.map((item) => {
          if (item.id !== itemId) return item;
          // If product is selected but searchQuery is empty, restore the name
          if (item.product_id && item.searchQuery === '') {
            return { ...item, searchQuery: item.product_name, showDropdown: false };
          }
          return { ...item, showDropdown: false };
        })
      );
    }, 150);
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
        subtotal: '',
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
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
        error = validatePhone(value, true);
        break;
      case 'phone2':
        error = validatePhone(value, false);
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

    const phoneError = validatePhone(formData.phone, true);
    if (phoneError) errors.phone = phoneError;

    const phone2Error = validatePhone(formData.phone2, false);
    if (phone2Error) errors.phone2 = phone2Error;

    const addressError = validateAddress(formData.address);
    if (addressError) errors.address = addressError;

    const commentError = validateComment(formData.comment);
    if (commentError) errors.comment = commentError;

    // Validate send_date (required)
    if (!formData.send_date) {
      errors.send_date = 'გაგზავნის თარიღი სავალდებულოა';
    }

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
          phone2: formData.phone2 || null,
          address: formData.address,
          comment: formData.comment || null,
          payment_type: formData.payment_type,
          send_date: formData.send_date || null,
          location: formData.location,
          added_by: formData.added_by,
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

  // Get effective subtotal: manual if set, otherwise calculated
  const getItemSubtotal = (item: OrderItem): number => {
    if (item.subtotal && item.subtotal.trim() !== '') {
      return parseFloat(item.subtotal) || 0;
    }
    return calculateItemTotal(item);
  };

  // Format number: no decimals if whole number, otherwise show decimals
  const formatNumber = (num: number): string => {
    if (Number.isInteger(num)) {
      return num.toString();
    }
    // Remove trailing zeros after decimal
    return num.toFixed(2).replace(/\.?0+$/, '');
  };

  // Calculate grand total using effective subtotals
  const totalPrice = orderItems.reduce((sum, item) => sum + getItemSubtotal(item), 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
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
              className={`w-full px-3 py-2.5 text-base border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700 ${
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
              className={`w-full px-3 py-2.5 text-base border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700 ${
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
              className={`w-full px-3 py-2.5 text-base border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700 ${
                fieldErrors.phone ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              required
            />
            {fieldErrors.phone && (
              <p className="text-red-500 dark:text-red-400 text-xs mt-1">{fieldErrors.phone}</p>
            )}
          </div>

          <div>
            <label htmlFor="phone2" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              ტელეფონი 2 <span className="text-gray-400 font-normal">(არასავალდებულო)</span>
            </label>
            <input
              id="phone2"
              name="phone2"
              type="tel"
              value={formData.phone2}
              onChange={handleChange}
              maxLength={VALIDATION_LIMITS.PHONE_MAX}
              placeholder="5XX XXX XXX"
              className={`w-full px-3 py-2.5 text-base border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700 ${
                fieldErrors.phone2 ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
            />
            {fieldErrors.phone2 && (
              <p className="text-red-500 dark:text-red-400 text-xs mt-1">{fieldErrors.phone2}</p>
            )}
          </div>

          <div>
            <label htmlFor="payment_type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              გადახდის ტიპი *
            </label>
            <select
              id="payment_type"
              name="payment_type"
              value={formData.payment_type}
              onChange={handleChange}
              className="w-full px-3 py-2.5 text-base border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700 cursor-pointer"
            >
              <option value="cash">ხელზე გადახდა</option>
              <option value="transfer">ჩარიცხვა</option>
            </select>
          </div>

          <div>
            <label htmlFor="send_date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              გაგზავნის თარიღი *
            </label>
            <input
              id="send_date"
              name="send_date"
              type="date"
              value={formData.send_date}
              onChange={handleChange}
              className={`w-full px-3 py-2.5 text-base border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700 ${
                fieldErrors.send_date ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              required
            />
            {fieldErrors.send_date && (
              <p className="text-red-500 dark:text-red-400 text-xs mt-1">{fieldErrors.send_date}</p>
            )}
          </div>
        </div>

        {/* Location selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            ლოკაცია *
          </label>
          <div className="flex gap-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="location"
                value="tbilisi"
                checked={formData.location === 'tbilisi'}
                onChange={handleChange}
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
              />
              <span className="ml-2 text-gray-800 dark:text-gray-200">თბილისი</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="location"
                value="region"
                checked={formData.location === 'region'}
                onChange={handleChange}
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
              />
              <span className="ml-2 text-gray-800 dark:text-gray-200">რეგიონები</span>
            </label>
          </div>
        </div>

        {/* Added by selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            ვინ დაამატა *
          </label>
          <div className="flex gap-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="added_by"
                value="ani"
                checked={formData.added_by === 'ani'}
                onChange={handleChange}
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
              />
              <span className="ml-2 text-gray-800 dark:text-gray-200">ანი</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="added_by"
                value="kato"
                checked={formData.added_by === 'kato'}
                onChange={handleChange}
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
              />
              <span className="ml-2 text-gray-800 dark:text-gray-200">კატო</span>
            </label>
          </div>
        </div>

        {/* Address - Full width textarea */}
        <div>
          <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            მისამართი * <span className="text-gray-400 font-normal">({formData.address.length}/{VALIDATION_LIMITS.ADDRESS_MAX})</span>
          </label>
          <textarea
            id="address"
            name="address"
            value={formData.address}
            onChange={handleChange}
            maxLength={VALIDATION_LIMITS.ADDRESS_MAX}
            placeholder="მიწოდების მისამართი"
            rows={3}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700 resize-none ${
              fieldErrors.address ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'
            }`}
            required
          />
          {fieldErrors.address && (
            <p className="text-red-500 dark:text-red-400 text-xs mt-1">{fieldErrors.address}</p>
          )}
        </div>

        {/* Products Section */}
        <div className="border-t dark:border-gray-700 pt-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-md font-medium text-gray-800 dark:text-white">პროდუქტები</h3>
            <button
              type="button"
              onClick={addOrderItem}
              className="px-4 py-2 text-sm bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-md hover:bg-green-200 dark:hover:bg-green-800 transition-colors cursor-pointer"
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
                      className="p-1.5 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md cursor-pointer"
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
                      onFocus={() => handleProductFocus(item.id)}
                      onBlur={() => handleProductBlur(item.id)}
                      placeholder="მოძებნეთ პროდუქტი..."
                      className="w-full px-3 py-2.5 text-base border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-600"
                    />
                    {item.showDropdown && getFilteredProducts(item.searchQuery).length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {getFilteredProducts(item.searchQuery).map((product) => {
                          const stockQty = Number(product.quantity);
                          const isOutOfStock = stockQty <= 0;
                          return (
                            <button
                              key={product.id}
                              type="button"
                              onClick={() => !isOutOfStock && handleProductSelect(item.id, product)}
                              disabled={isOutOfStock}
                              className={`w-full px-4 py-3 text-left flex justify-between items-center ${
                                isOutOfStock
                                  ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed opacity-60'
                                  : 'hover:bg-gray-100 dark:hover:bg-gray-500 cursor-pointer'
                              }`}
                            >
                              <div className="flex flex-col">
                                <span className={`${isOutOfStock ? 'text-gray-500 dark:text-gray-400' : 'text-gray-800 dark:text-white'}`}>
                                  {product.name}
                                </span>
                                <span className={`text-xs ${
                                  isOutOfStock
                                    ? 'text-red-500 dark:text-red-400'
                                    : stockQty <= 3
                                    ? 'text-orange-500 dark:text-orange-400'
                                    : 'text-gray-400 dark:text-gray-500'
                                }`}>
                                  {isOutOfStock ? 'არ არის მარაგში' : `მარაგში: ${stockQty}`}
                                </span>
                              </div>
                              <span className="text-gray-500 dark:text-gray-300 text-sm">₾{Number(product.price).toFixed(2)}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Quantity */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      რაოდენობა *
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                      placeholder="1"
                      className="w-full px-3 py-2.5 text-base border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-600"
                    />
                  </div>

                  {/* Unit Price (editable) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      ფასი
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={item.unit_price}
                      onChange={(e) => handleItemChange(item.id, 'unit_price', e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2.5 text-base border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-600"
                    />
                  </div>

                  {/* Courier Price */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      კურიერი
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={item.courier_price}
                      onChange={(e) => handleItemChange(item.id, 'courier_price', e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2.5 text-base border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-600"
                    />
                  </div>

                  {/* Item Subtotal (editable) */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      ქვეჯამი
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-700 dark:text-blue-300 font-medium pointer-events-none">₾</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={item.subtotal || formatNumber(calculateItemTotal(item))}
                        onChange={(e) => handleItemChange(item.id, 'subtotal', e.target.value)}
                        placeholder="0"
                        className="w-full pl-7 pr-3 py-2.5 text-base border border-blue-300 dark:border-blue-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium"
                      />
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
                ₾{formatNumber(totalPrice)}
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

        {/* Error Display - Mobile Optimized */}
        {error && (
          <div ref={errorRef} className="relative">
            {/* Inline error for context */}
            <div className="bg-red-50 dark:bg-red-900/30 border-2 border-red-400 dark:border-red-600 rounded-xl p-4 shadow-lg">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 sm:w-8 sm:h-8 bg-red-100 dark:bg-red-800 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 sm:w-5 sm:h-5 text-red-600 dark:text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-red-800 dark:text-red-200 font-semibold text-base sm:text-sm">შეკვეთა ვერ დაემატა</p>
                  <p className="text-red-700 dark:text-red-300 text-base sm:text-sm mt-1 break-words">{error}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setError('')}
                  className="p-2 -mr-2 -mt-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200 touch-manipulation"
                >
                  <svg className="w-6 h-6 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Full-screen error modal for mobile */}
        {showErrorModal && error && (
          <div className="fixed inset-0 z-50 sm:hidden flex items-end justify-center bg-black/50 animate-fadeIn">
            <div className="w-full bg-white dark:bg-gray-800 rounded-t-2xl p-6 pb-8 shadow-2xl animate-slideUp">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-10 h-10 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">შეკვეთა ვერ დაემატა</h3>
                <p className="text-gray-600 dark:text-gray-300 text-lg mb-6">{error}</p>
                <button
                  type="button"
                  onClick={() => setShowErrorModal(false)}
                  className="w-full py-4 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-lg font-semibold rounded-xl transition-colors touch-manipulation"
                >
                  გასაგებია
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="w-full sm:w-auto px-4 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors cursor-pointer"
          >
            გაუქმება
          </button>
          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
          >
            {loading ? 'შენახვა...' : 'დამატება'}
          </button>
        </div>
      </form>
    </div>
  );
}
