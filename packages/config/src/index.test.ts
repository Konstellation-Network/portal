import { describe, expect, it } from 'vitest';
import { loadConfig } from './index.ts';

const base = { DATABASE_URL: 'postgres://portal:portal@localhost:5432/portal' };

describe('loadConfig', () => {
  it('applies defaults', () => {
    const config = loadConfig(base);
    expect(config.PORT).toBe(8080);
    expect(config.WEB_ORIGINS).toEqual(['http://localhost:5173']);
    expect(config.ORIGIN_AUTH_SECRETS).toEqual([]);
    expect(config.PLATFORM).toBe('local');
  });

  it('splits comma-separated lists', () => {
    const config = loadConfig({ ...base, ORIGIN_AUTH_SECRETS: 'old, new ,' });
    expect(config.ORIGIN_AUTH_SECRETS).toEqual(['old', 'new']);
  });

  it('refuses a missing database URL', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });

  it('refuses production without an origin secret', () => {
    expect(() => loadConfig({ ...base, NODE_ENV: 'production' })).toThrow(/ORIGIN_AUTH_SECRETS/);
  });
});
