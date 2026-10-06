// Applies pending migrations, then exits. Deploys run this as its own job
// (Cloud Run job `migrate`, or a one-shot container on Contabo) before the API.
import { runMigrations } from '@portal/db';

const url = process.env['DATABASE_URL'];
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}
await runMigrations(url);
console.log('migrations applied');
