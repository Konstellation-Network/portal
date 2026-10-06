// Writes the OpenAPI spec the SDK is generated from (`npm run openapi` at the
// repo root). CI regenerates it and fails if the committed copy is stale.
import { writeFile } from 'node:fs/promises';
import { buildApp } from './app.ts';

const app = await buildApp({
  config: { NODE_ENV: 'development', LOG_LEVEL: 'silent', ORIGIN_AUTH_SECRETS: [] },
  ping: async () => {},
});
await app.ready();
const out = new URL('../openapi.json', import.meta.url);
await writeFile(out, `${JSON.stringify(app.swagger(), null, 2)}\n`);
await app.close();
console.log(`wrote ${out.pathname}`);
