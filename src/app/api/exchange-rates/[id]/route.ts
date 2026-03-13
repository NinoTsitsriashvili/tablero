import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb } from '@/lib/db';

// DELETE - remove exchange rate
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sql = getDb();
    const { id } = await params;

    await sql`DELETE FROM exchange_rates WHERE id = ${id}`;

    return NextResponse.json({ message: 'Exchange rate deleted' });
  } catch (error) {
    console.error('Error deleting exchange rate:', error);
    return NextResponse.json({ error: 'Failed to delete exchange rate' }, { status: 500 });
  }
}
