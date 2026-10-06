import { systemClock, type Clock } from '@portal/core';
import type { RateLimiter } from './ports.ts';

/**
 * Token bucket per key, held in this process. Each API instance keeps its own
 * buckets, so with N instances a client can get up to N× the limit; Cloudflare's
 * edge rule and Turnstile sit in front. Redis replaces this where limits must be
 * shared exactly (Contabo, or GCP at scale).
 */
export class MemoryRateLimiter implements RateLimiter {
  readonly #buckets = new Map<string, { tokens: number; updatedMs: number }>();
  readonly #capacity: number;
  readonly #refillPerMs: number;
  readonly #clock: Clock;
  readonly #maxKeys: number;

  constructor(options: {
    capacity: number;
    refillPerMinute: number;
    clock?: Clock;
    maxKeys?: number;
  }) {
    this.#capacity = options.capacity;
    this.#refillPerMs = options.refillPerMinute / 60_000;
    this.#clock = options.clock ?? systemClock;
    this.#maxKeys = options.maxKeys ?? 100_000;
  }

  async consume(key: string, cost = 1): Promise<{ allowed: boolean; retryAfterMs: number }> {
    const nowMs = this.#clock.now().getTime();
    const bucket = this.#buckets.get(key) ?? { tokens: this.#capacity, updatedMs: nowMs };
    bucket.tokens = Math.min(
      this.#capacity,
      bucket.tokens + (nowMs - bucket.updatedMs) * this.#refillPerMs,
    );
    bucket.updatedMs = nowMs;
    // Bound memory under a flood of distinct keys: forget the oldest entry.
    if (!this.#buckets.has(key) && this.#buckets.size >= this.#maxKeys) {
      const oldest = this.#buckets.keys().next().value;
      if (oldest !== undefined) this.#buckets.delete(oldest);
    }
    this.#buckets.delete(key);
    this.#buckets.set(key, bucket);
    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      return { allowed: true, retryAfterMs: 0 };
    }
    return { allowed: false, retryAfterMs: Math.ceil((cost - bucket.tokens) / this.#refillPerMs) };
  }
}
