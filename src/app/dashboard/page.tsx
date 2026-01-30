import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import Navbar from '@/components/Navbar';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">მთავარი</h1>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p className="text-gray-600 dark:text-gray-300">
            კეთილი იყოს თქვენი მობრძანება Tablero-ში! ეს არის თქვენი ადმინ პანელი.
          </p>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            გამოიყენეთ ნავიგაცია საწყობის სამართავად.
          </p>
        </div>
      </main>
    </div>
  );
}
