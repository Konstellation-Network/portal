import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * True when `given` equals one of `accepted`. Compares SHA-256 digests in
 * constant time, so neither the secret's content nor its length leaks through
 * timing. Accepting several values lets a secret rotate without downtime.
 */
export function matchesSecret(given: string | undefined, accepted: readonly string[]): boolean {
  if (given === undefined || given.length === 0) return false;
  const digest = createHash('sha256').update(given).digest();
  let match = false;
  for (const secret of accepted) {
    const expected = createHash('sha256').update(secret).digest();
    if (timingSafeEqual(digest, expected)) match = true;
  }
  return match;
}
