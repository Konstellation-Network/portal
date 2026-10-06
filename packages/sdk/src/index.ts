import createClient from 'openapi-fetch';
import type { paths } from './schema.ts';

/**
 * Typed client for the Portal API, generated from apps/api/openapi.json
 * (`npm run openapi`). The web app uses it now; the mobile app will too.
 *
 * Web: baseUrl '/api' (the Pages Function forwards to the API, so the
 * refresh cookie stays first-party). Mobile: the API's own address.
 */
export function createPortalClient(baseUrl: string) {
  return createClient<paths>({ baseUrl, credentials: 'include' });
}

export type PortalClient = ReturnType<typeof createPortalClient>;
export type { paths };
