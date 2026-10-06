import { describe, expect, it } from 'vitest';
import { buildApp, type AppDeps } from './app.ts';

const config = (secrets: string[] = []): AppDeps['config'] => ({
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  ORIGIN_AUTH_SECRETS: secrets,
});

describe('api', () => {
  it('answers /healthz with a request id', async () => {
    const app = await buildApp({ config: config(), ping: async () => {} });
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('ignores a client-supplied request id', async () => {
    const app = await buildApp({ config: config(), ping: async () => {} });
    const res = await app.inject({
      method: 'GET',
      url: '/healthz',
      headers: { 'request-id': 'spoofed' },
    });
    expect(res.headers['x-request-id']).not.toBe('spoofed');
  });

  it('reports the database on /readyz', async () => {
    const down = await buildApp({
      config: config(),
      ping: async () => {
        throw new Error('down');
      },
    });
    const res = await down.inject({ method: 'GET', url: '/readyz' });
    expect(res.statusCode).toBe(503);
    expect(res.json().error.code).toBe('unavailable');
  });

  it('returns the shared error shape for an unknown route', async () => {
    const app = await buildApp({ config: config(), ping: async () => {} });
    const res = await app.inject({ method: 'GET', url: '/v1/nope' });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error.code).toBe('not_found');
    expect(body.error.request_id).toBe(res.headers['x-request-id']);
  });

  describe('origin header', () => {
    const secrets = ['old-secret', 'new-secret'];

    it('refuses a request without it', async () => {
      const app = await buildApp({ config: config(secrets), ping: async () => {} });
      const res = await app.inject({ method: 'GET', url: '/v1/openapi.json' });
      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe('forbidden');
    });

    it('accepts either secret during a rotation', async () => {
      const app = await buildApp({ config: config(secrets), ping: async () => {} });
      for (const secret of secrets) {
        const res = await app.inject({
          method: 'GET',
          url: '/v1/openapi.json',
          headers: { 'x-origin-auth': secret },
        });
        expect(res.statusCode).toBe(200);
      }
    });

    it('lets health checks and webhooks through without it', async () => {
      const app = await buildApp({ config: config(secrets), ping: async () => {} });
      expect((await app.inject({ method: 'GET', url: '/healthz' })).statusCode).toBe(200);
      expect((await app.inject({ method: 'GET', url: '/readyz' })).statusCode).toBe(200);
      // No webhook route exists yet: the request passes the check and gets a 404.
      const hook = await app.inject({ method: 'POST', url: '/webhooks/pouch', payload: {} });
      expect(hook.statusCode).toBe(404);
    });
  });

  it('does not serve the spec in production', async () => {
    const app = await buildApp({
      config: { ...config(['s']), NODE_ENV: 'production' },
      ping: async () => {},
    });
    const res = await app.inject({
      method: 'GET',
      url: '/v1/openapi.json',
      headers: { 'x-origin-auth': 's' },
    });
    expect(res.statusCode).toBe(404);
  });
});
