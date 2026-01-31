import { neon } from '@neondatabase/serverless';

// Create a cached SQL function for connection reuse
let cachedSql: ReturnType<typeof neon> | null = null;

export function getDb() {
  if (cachedSql) {
    return cachedSql;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  cachedSql = neon(databaseUrl);
  return cachedSql;
}
