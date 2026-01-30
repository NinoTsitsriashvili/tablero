'use client';

import { Product } from '@/app/storage/page';
import Image from 'next/image';

interface ProductCardProps {
  product: Product;
  onEdit: (product: Product) => void;
  onDelete: (id: number) => void;
}

export default function ProductCard({ product, onEdit, onDelete }: ProductCardProps) {
  const profit = product.cost_price ? product.price - product.cost_price : null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      {product.photo_url ? (
        <div className="relative h-48 w-full bg-gray-100 dark:bg-gray-700">
          <Image
            src={product.photo_url}
            alt={product.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        </div>
      ) : (
        <div className="h-48 w-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
          <span className="text-gray-400 dark:text-gray-500 text-sm">ფოტო არ არის</span>
        </div>
      )}

      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-gray-800 dark:text-white text-lg">{product.name}</h3>
          <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-1 rounded">
            ID: {product.id}
          </span>
        </div>

        {product.barcode && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">შტრიხკოდი: {product.barcode}</p>
        )}

        <div className="grid grid-cols-2 gap-2 text-sm mb-3">
          <div>
            <span className="text-gray-500 dark:text-gray-400">ფასი:</span>
            <span className="ml-1 font-medium text-gray-800 dark:text-white">₾{product.price.toFixed(2)}</span>
          </div>
          {product.cost_price && (
            <div>
              <span className="text-gray-500 dark:text-gray-400">თვითღირ.:</span>
              <span className="ml-1 text-gray-800 dark:text-gray-300">₾{product.cost_price.toFixed(2)}</span>
            </div>
          )}
          <div>
            <span className="text-gray-500 dark:text-gray-400">მარაგი:</span>
            <span className={`ml-1 font-medium ${product.quantity > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {product.quantity}
            </span>
          </div>
          {profit !== null && (
            <div>
              <span className="text-gray-500 dark:text-gray-400">მოგება:</span>
              <span className={`ml-1 font-medium ${profit > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                ₾{profit.toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {product.description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">{product.description}</p>
        )}

        <div className="flex justify-end space-x-2">
          <button
            onClick={() => onEdit(product)}
            className="px-3 py-1 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
          >
            რედაქტირება
          </button>
          <button
            onClick={() => onDelete(product.id)}
            className="px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
          >
            წაშლა
          </button>
        </div>
      </div>
    </div>
  );
}
