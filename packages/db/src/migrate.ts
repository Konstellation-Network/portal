import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDb } from './client.ts';

export const migrationsFolder = fileURLToPath(new URL('../migrations', import.meta.url));

/** Apply every pending migration. Run as its own job before an API release. */
export async function runMigrations(url: string): Promise<void> {
  const database = createDb(url, { max: 1 });
  try {
    await migrate(database.db, { migrationsFolder });
  } finally {
    await database.close();
  }
}
