import { loadConfig } from '@portal/config';
import { createDb } from '@portal/db';
import { buildApp } from './app.ts';

const config = loadConfig();
const database = createDb(config.DATABASE_URL);
const app = await buildApp({ config, ping: database.ping });

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down');
  await app.close();
  await database.close();
  process.exit(0);
};
process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));

await app.listen({ host: '0.0.0.0', port: config.PORT });
