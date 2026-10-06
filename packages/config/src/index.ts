import { z } from 'zod';

const list = (fallback: string) =>
  z
    .string()
    .default(fallback)
    .transform((s) =>
      s
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v.length > 0),
    );

export const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.url(),
  // Origins allowed to call the API from a browser.
  WEB_ORIGINS: list('http://localhost:5173'),
  // Secrets the web app's Pages Function sends in X-Origin-Auth (with a domain,
  // a Cloudflare Transform Rule). Two during a rotation; empty turns the check off.
  ORIGIN_AUTH_SECRETS: list(''),
  // Where the API runs. GCP and Contabo stay open (STATUS P33); only scheduled-job
  // auth, rate limits and the database connection differ between them.
  PLATFORM: z.enum(['gcp', 'contabo', 'local']).default('local'),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = configSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid configuration:\n${z.prettifyError(parsed.error)}`);
  }
  const config = parsed.data;
  if (config.NODE_ENV === 'production' && config.ORIGIN_AUTH_SECRETS.length === 0) {
    throw new Error('ORIGIN_AUTH_SECRETS must be set in production');
  }
  return config;
}
