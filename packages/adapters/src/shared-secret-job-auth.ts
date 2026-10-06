import type { JobAuth } from './ports.ts';
import { matchesSecret } from './secrets.ts';

/**
 * Job auth for Contabo, where systemd timers call /jobs/* with a shared secret
 * in `X-Job-Auth`. On GCP, Cloud Scheduler's Google OIDC token is checked
 * instead (added with the jobs in milestone 5).
 */
export class SharedSecretJobAuth implements JobAuth {
  readonly #secrets: readonly string[];

  constructor(secrets: readonly string[]) {
    this.#secrets = secrets;
  }

  async verify(headers: Record<string, string | string[] | undefined>): Promise<boolean> {
    const value = headers['x-job-auth'];
    return matchesSecret(Array.isArray(value) ? value[0] : value, this.#secrets);
  }
}
