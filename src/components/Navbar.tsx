'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';

export default function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/storage', label: 'Storage' },
  ];

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <span className="text-xl font-bold text-gray-800">Tablero</span>
            <div className="flex space-x-4">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    pathname === item.href
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center">
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
