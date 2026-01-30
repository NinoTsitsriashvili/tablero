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
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h1>

        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600">
            Welcome to Tablero! This is your admin panel dashboard.
          </p>
          <p className="text-gray-500 mt-2">
            Use the navigation to access Storage and manage your inventory.
          </p>
        </div>
      </main>
    </div>
  );
}
