import { defineConfig } from 'drizzle-kit';

// `npm run db:generate` turns schema changes into a new SQL file in migrations/.
// Migrations only ever add (expand, then contract a release later), so rolling
// the API back never meets a schema it cannot read.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './migrations',
});
