import { fixedClock } from '@portal/core';
import { describe, expect, it } from 'vitest';
import { MemoryRateLimiter } from './memory-rate-limiter.ts';
import { matchesSecret } from './secrets.ts';
import { SharedSecretJobAuth } from './shared-secret-job-auth.ts';

describe('matchesSecret', () => {
  it('accepts any configured secret, so a secret can rotate', () => {
    expect(matchesSecret('new', ['old', 'new'])).toBe(true);
    expect(matchesSecret('old', ['old', 'new'])).toBe(true);
  });

  it('refuses a wrong, empty or missing value', () => {
    expect(matchesSecret('nope', ['old', 'new'])).toBe(false);
    expect(matchesSecret('', [''])).toBe(false);
    expect(matchesSecret(undefined, ['old'])).toBe(false);
  });
});

describe('MemoryRateLimiter', () => {
  it('allows the capacity, refuses the next request, then refills', async () => {
    const clock = fixedClock('2026-10-06T00:00:00Z');
    const limiter = new MemoryRateLimiter({ capacity: 3, refillPerMinute: 60, clock });
    for (let i = 0; i < 3; i++) expect((await limiter.consume('u1')).allowed).toBe(true);
    const refused = await limiter.consume('u1');
    expect(refused.allowed).toBe(false);
    expect(refused.retryAfterMs).toBe(1000);
    clock.advance(1000);
    expect((await limiter.consume('u1')).allowed).toBe(true);
  });

  it('keeps keys apart', async () => {
    const limiter = new MemoryRateLimiter({ capacity: 1, refillPerMinute: 1 });
    expect((await limiter.consume('a')).allowed).toBe(true);
    expect((await limiter.consume('b')).allowed).toBe(true);
    expect((await limiter.consume('a')).allowed).toBe(false);
  });

  it('bounds memory under many distinct keys', async () => {
    const limiter = new MemoryRateLimiter({ capacity: 1, refillPerMinute: 1, maxKeys: 2 });
    await limiter.consume('a');
    await limiter.consume('b');
    await limiter.consume('c'); // evicts a
    expect((await limiter.consume('a')).allowed).toBe(true);
  });
});

describe('SharedSecretJobAuth', () => {
  it('checks the X-Job-Auth header', async () => {
    const auth = new SharedSecretJobAuth(['s3cret']);
    expect(await auth.verify({ 'x-job-auth': 's3cret' })).toBe(true);
    expect(await auth.verify({ 'x-job-auth': 'wrong' })).toBe(false);
    expect(await auth.verify({})).toBe(false);
  });
});
