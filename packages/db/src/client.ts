import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.ts';

/**
 * One connection pool per process. Keep `max` small: the smallest Cloud SQL tier
 * allows about 25 connections across every API instance.
 */
export function createDb(url: string, options: { max?: number } = {}) {
  const sql = postgres(url, { max: options.max ?? 5, onnotice: () => {} });
  return {
    db: drizzle(sql, { schema }),
    sql,
    ping: async () => {
      await sql`select 1`;
    },
    close: () => sql.end({ timeout: 5 }),
  };
}

export type Database = ReturnType<typeof createDb>;
