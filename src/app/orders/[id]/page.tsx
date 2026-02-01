'use client';

import { useState, useEffect, use } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Navbar from '@/components/Navbar';

interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  product_name: string | null;
  product_photo_url: string | null;
  quantity: number;
  unit_price: number;
  courier_price: number;
}

interface OrderWithItems {
  id: number;
  fb_name: string;
  recipient_name: string;
  phone: string;
  phone2: string | null;
  address: string;
  comment: string | null;
  status: string;
  payment_type: string;
  send_date: string | null;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
  total_price: number;
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
};

// Georgian phone pattern
const GEORGIAN_PHONE_REGEX = /^(\+995\s?)?5\d{8}$/;

interface EditFormData {
  fb_name: string;
  recipient_name: string;
  phone: string;
  phone2: string;
  address: string;
  comment: string;
  payment_type: string;
  send_date: string;
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session, status } = useSession();
  const router = useRouter();
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [editForm, setEditForm] = useState<EditFormData>({
    fb_name: '',
    recipient_name: '',
    phone: '',
    phone2: '',
    address: '',
    comment: '',
    payment_type: 'cash',
    send_date: '',
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    if (session && id) {
      fetchOrder();
    }
  }, [session, id]);

  const fetchOrder = async () => {
    try {
      const res = await fetch(`/api/orders/${id}`);
      if (res.ok) {
        const data = await res.json();
        setOrder(data);
      } else {
        setError('შეკვეთა ვერ მოიძებნა');
      }
    } catch (error) {
      console.error('Error fetching order:', error);
      setError('შეცდომა მოხდა');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('ნამდვილად გსურთ შეკვეთის წაშლა?')) {
      return;
    }

    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        router.push('/orders');
      }
    } catch (error) {
      console.error('Error deleting order:', error);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        fetchOrder();
      }
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const startEditing = () => {
    if (order) {
      setEditForm({
        fb_name: order.fb_name,
        recipient_name: order.recipient_name,
        phone: order.phone,
        phone2: order.phone2 || '',
        address: order.address,
        comment: order.comment || '',
        payment_type: order.payment_type || 'cash',
        send_date: order.send_date ? order.send_date.split('T')[0] : '',
      });
      setEditError('');
      setIsEditing(true);
    }
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditError('');
  };

  const validateEditForm = (): string | null => {
    // FB name
    if (!editForm.fb_name || editForm.fb_name.trim().length < VALIDATION_LIMITS.NAME_MIN) {
      return `FB სახელი მინიმუმ ${VALIDATION_LIMITS.NAME_MIN} სიმბოლო`;
    }
    // Recipient name
    if (!editForm.recipient_name || editForm.recipient_name.trim().length < VALIDATION_LIMITS.NAME_MIN) {
      return `ადრესატის სახელი მინიმუმ ${VALIDATION_LIMITS.NAME_MIN} სიმბოლო`;
    }
    // Phone
    const cleanPhone = editForm.phone.replace(/\s/g, '');
    if (cleanPhone.length < VALIDATION_LIMITS.PHONE_MIN) {
      return `ტელეფონი მინიმუმ ${VALIDATION_LIMITS.PHONE_MIN} ციფრი`;
    }
    if (!GEORGIAN_PHONE_REGEX.test(cleanPhone)) {
      return 'არასწორი ტელეფონის ფორმატი (მაგ: 5XXXXXXXX)';
    }
    // Phone2 (optional)
    if (editForm.phone2 && editForm.phone2.trim().length > 0) {
      const cleanPhone2 = editForm.phone2.replace(/\s/g, '');
      if (cleanPhone2.length < VALIDATION_LIMITS.PHONE_MIN) {
        return `ტელეფონი 2 მინიმუმ ${VALIDATION_LIMITS.PHONE_MIN} ციფრი`;
      }
      if (!GEORGIAN_PHONE_REGEX.test(cleanPhone2)) {
        return 'ტელეფონი 2: არასწორი ფორმატი (მაგ: 5XXXXXXXX)';
      }
    }
    // Address
    if (!editForm.address || editForm.address.trim().length < VALIDATION_LIMITS.ADDRESS_MIN) {
      return `მისამართი მინიმუმ ${VALIDATION_LIMITS.ADDRESS_MIN} სიმბოლო`;
    }
    return null;
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateEditForm();
    if (validationError) {
      setEditError(validationError);
      return;
    }

    setEditLoading(true);
    setEditError('');

    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fb_name: editForm.fb_name,
          recipient_name: editForm.recipient_name,
          phone: editForm.phone,
          phone2: editForm.phone2 || null,
          address: editForm.address,
          comment: editForm.comment || null,
          payment_type: editForm.payment_type,
          send_date: editForm.send_date || null,
          status: order?.status || 'pending',
        }),
      });

      if (res.ok) {
        setIsEditing(false);
        fetchOrder();
      } else {
        const data = await res.json();
        setEditError(data.error || 'შენახვა ვერ მოხერხდა');
      }
    } catch (error) {
      console.error('Error updating order:', error);
      setEditError('შეცდომა მოხდა');
    } finally {
      setEditLoading(false);
    }
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
      shipped: 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200',
      delivered: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
      cancelled: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
    };
    const labels: Record<string, string> = {
      pending: 'მოლოდინში',
      shipped: 'გაგზავნილი',
      delivered: 'მიწოდებული',
      cancelled: 'გაუქმებული',
    };
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles[status] || styles.pending}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getPaymentTypeBadge = (paymentType: string) => {
    const styles: Record<string, string> = {
      cash: 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200',
      transfer: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
    };
    const labels: Record<string, string> = {
      cash: 'ხელზე გადახდა',
      transfer: 'ჩარიცხვა',
    };
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles[paymentType] || styles.cash}`}>
        {labels[paymentType] || paymentType}
      </span>
    );
  };

  const statusOptions = [
    { value: 'pending', label: 'მოლოდინში' },
    { value: 'shipped', label: 'გაგზავნილი' },
    { value: 'delivered', label: 'მიწოდებული' },
    { value: 'cancelled', label: 'გაუქმებული' },
  ];

  const calculateItemSubtotal = (item: OrderItem) => {
    return (Number(item.unit_price) * Number(item.quantity)) + Number(item.courier_price || 0);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="mb-6">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-40 animate-pulse"></div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="p-6 animate-pulse">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-40 mb-2"></div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-56"></div>
                </div>
                <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
              </div>
              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-24"></div>
                  <div className="h-10 bg-gray-300 dark:bg-gray-600 rounded w-32"></div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-16 mb-2"></div>
                    <div className="h-5 bg-gray-200 dark:bg-gray-600 rounded w-32"></div>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 flex gap-4">
                    <div className="w-16 h-16 bg-gray-200 dark:bg-gray-600 rounded-lg"></div>
                    <div className="flex-1">
                      <div className="h-5 bg-gray-200 dark:bg-gray-600 rounded w-32 mb-2"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-24"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <p className="text-red-500 dark:text-red-400">{error || 'შეკვეთა ვერ მოიძებნა'}</p>
            <Link href="/orders" className="text-blue-600 dark:text-blue-400 hover:underline mt-4 inline-block">
              დაბრუნება შეკვეთებში
            </Link>
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
          <Link href="/orders" className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            შეკვეთებში დაბრუნება
          </Link>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="p-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white">შეკვეთა #{order.id}</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  შექმნილია: {new Date(order.created_at).toLocaleString('ka-GE')}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={startEditing}
                  className="px-4 py-2 text-sm bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors cursor-pointer"
                >
                  რედაქტირება
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 text-sm bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-md hover:bg-red-200 dark:hover:bg-red-800 transition-colors cursor-pointer"
                >
                  წაშლა
                </button>
              </div>
            </div>

            {/* Edit Form */}
            {isEditing && (
              <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">შეკვეთის რედაქტირება</h2>
                <form onSubmit={handleEditSubmit}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label htmlFor="edit_fb_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        FB სახელი *
                      </label>
                      <input
                        id="edit_fb_name"
                        name="fb_name"
                        type="text"
                        value={editForm.fb_name}
                        onChange={handleEditChange}
                        maxLength={VALIDATION_LIMITS.NAME_MAX}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="edit_recipient_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        ადრესატის სახელი *
                      </label>
                      <input
                        id="edit_recipient_name"
                        name="recipient_name"
                        type="text"
                        value={editForm.recipient_name}
                        onChange={handleEditChange}
                        maxLength={VALIDATION_LIMITS.NAME_MAX}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="edit_phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        ტელეფონი *
                      </label>
                      <input
                        id="edit_phone"
                        name="phone"
                        type="tel"
                        value={editForm.phone}
                        onChange={handleEditChange}
                        maxLength={VALIDATION_LIMITS.PHONE_MAX}
                        placeholder="5XX XXX XXX"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="edit_phone2" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        ტელეფონი 2 <span className="text-gray-400 font-normal">(არასავალდებულო)</span>
                      </label>
                      <input
                        id="edit_phone2"
                        name="phone2"
                        type="tel"
                        value={editForm.phone2}
                        onChange={handleEditChange}
                        maxLength={VALIDATION_LIMITS.PHONE_MAX}
                        placeholder="5XX XXX XXX"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700"
                      />
                    </div>
                    <div>
                      <label htmlFor="edit_payment_type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        გადახდის ტიპი *
                      </label>
                      <select
                        id="edit_payment_type"
                        name="payment_type"
                        value={editForm.payment_type}
                        onChange={handleEditChange}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700 cursor-pointer"
                      >
                        <option value="cash">ხელზე გადახდა</option>
                        <option value="transfer">ჩარიცხვა</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="edit_send_date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        გაგზავნის თარიღი <span className="text-gray-400 font-normal">(არასავალდებულო)</span>
                      </label>
                      <input
                        id="edit_send_date"
                        name="send_date"
                        type="date"
                        value={editForm.send_date}
                        onChange={handleEditChange}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700"
                      />
                    </div>
                  </div>

                  <div className="mb-4">
                    <label htmlFor="edit_address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      მისამართი *
                    </label>
                    <textarea
                      id="edit_address"
                      name="address"
                      value={editForm.address}
                      onChange={handleEditChange}
                      maxLength={VALIDATION_LIMITS.ADDRESS_MAX}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700 resize-none"
                      required
                    />
                  </div>

                  <div className="mb-4">
                    <label htmlFor="edit_comment" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      კომენტარი <span className="text-gray-400 font-normal">(არასავალდებულო)</span>
                    </label>
                    <textarea
                      id="edit_comment"
                      name="comment"
                      value={editForm.comment}
                      onChange={handleEditChange}
                      maxLength={VALIDATION_LIMITS.COMMENT_MAX}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-700 resize-none"
                    />
                  </div>

                  {editError && (
                    <p className="text-red-500 dark:text-red-400 text-sm mb-4">{editError}</p>
                  )}

                  <div className="flex gap-3 justify-end">
                    <button
                      type="button"
                      onClick={cancelEditing}
                      disabled={editLoading}
                      className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors cursor-pointer"
                    >
                      გაუქმება
                    </button>
                    <button
                      type="submit"
                      disabled={editLoading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      {editLoading ? 'შენახვა...' : 'შენახვა'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Status & Payment Section */}
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">სტატუსი</p>
                    {getStatusBadge(order.status)}
                  </div>
                  <div>
                    <label htmlFor="statusSelect" className="sr-only">სტატუსის შეცვლა</label>
                    <select
                      id="statusSelect"
                      value={order.status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      disabled={updatingStatus}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white dark:bg-gray-600 cursor-pointer"
                    >
                      {statusOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">გადახდის ტიპი</p>
                    {getPaymentTypeBadge(order.payment_type || 'cash')}
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">გაგზავნის თარიღი</p>
                    <p className="text-gray-800 dark:text-white font-medium">
                      {order.send_date ? new Date(order.send_date).toLocaleDateString('ka-GE') : '--'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Customer Info */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">მომხმარებლის ინფორმაცია</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">FB სახელი</p>
                  <p className="text-gray-800 dark:text-white font-medium">{order.fb_name}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">ადრესატის სახელი</p>
                  <p className="text-gray-800 dark:text-white font-medium">{order.recipient_name}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">ტელეფონი</p>
                  <p className="text-gray-800 dark:text-white font-medium">{order.phone}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">ტელეფონი 2</p>
                  <p className="text-gray-800 dark:text-white font-medium">{order.phone2 || '--'}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 md:col-span-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">მისამართი</p>
                  <p className="text-gray-800 dark:text-white font-medium whitespace-pre-wrap">{order.address}</p>
                </div>
              </div>
            </div>

            {/* Products */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">
                პროდუქტები ({order.items?.length || 0})
              </h2>
              <div className="space-y-3">
                {order.items?.map((item, index) => (
                  <div key={item.id || index} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <div className="flex items-start gap-4">
                      {item.product_photo_url && (
                        <div className="w-16 h-16 bg-gray-200 dark:bg-gray-600 rounded-lg overflow-hidden flex-shrink-0 relative">
                          <Image
                            src={item.product_photo_url}
                            alt={item.product_name || 'Product'}
                            fill
                            sizes="64px"
                            className="object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-gray-800 dark:text-white font-medium">
                              {item.product_name || 'N/A'}
                            </p>
                            <Link
                              href={`/storage/${item.product_id}`}
                              className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
                            >
                              პროდუქტის ნახვა
                            </Link>
                          </div>
                          <div className="text-right">
                            <p className="text-gray-800 dark:text-white font-bold">
                              ₾{calculateItemSubtotal(item).toFixed(2)}
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">ფასი: </span>
                            <span className="text-gray-800 dark:text-gray-300">₾{Number(item.unit_price).toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">რაოდენობა: </span>
                            <span className="text-gray-800 dark:text-gray-300">{item.quantity}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">კურიერი: </span>
                            <span className="text-gray-800 dark:text-gray-300">₾{Number(item.courier_price || 0).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="mb-6">
              <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <p className="text-lg font-semibold text-green-700 dark:text-green-300">სულ ჯამი</p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                    ₾{Number(order.total_price).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {/* Comment */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">კომენტარი</h2>
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <p className="text-gray-800 dark:text-gray-300 whitespace-pre-wrap">{order.comment || '--'}</p>
              </div>
            </div>

            {/* Timestamps */}
            <div className="border-t dark:border-gray-700 pt-4 mt-4">
              <div className="grid grid-cols-2 gap-4 text-sm text-gray-500 dark:text-gray-400">
                <div>
                  <span>შექმნილია: </span>
                  <span className="text-gray-800 dark:text-gray-300">
                    {new Date(order.created_at).toLocaleString('ka-GE')}
                  </span>
                </div>
                <div>
                  <span>განახლებულია: </span>
                  <span className="text-gray-800 dark:text-gray-300">
                    {new Date(order.updated_at).toLocaleString('ka-GE')}
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
