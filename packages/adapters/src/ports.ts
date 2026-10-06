/**
 * The outside world, as the rules see it. Each vendor or platform sits behind
 * one of these, so it can be swapped without touching packages/core: Decane
 * already replaced Privy once, Pouch covers three countries, and hosting is
 * still GCP or Contabo (STATUS P33).
 */

/** Sign-in. Implemented for Decane Kit in milestone 1. */
export interface AuthProvider {
  /** Verify a provider token; the address comes from the provider, never the client. */
  verify(token: string): Promise<{ subject: string; evmAddress: string }>;
}

/** Fiat payments. Implemented for Pouch in milestone 4. */
export interface PaymentProvider {
  /** Create (once) the account the user tops up by bank transfer. */
  fundingAccount(input: {
    userId: string;
    firstName: string;
    lastName: string;
  }): Promise<{ accountNumber: string; bankName: string; accountName: string }>;
  /** Check a webhook signature over the raw body. */
  verifyWebhook(rawBody: Buffer, signature: string | undefined): boolean;
}

/** Shared or per-instance request limits. Memory now; Redis on Contabo. */
export interface RateLimiter {
  consume(key: string, cost?: number): Promise<{ allowed: boolean; retryAfterMs: number }>;
}

/** Who may call /jobs/*: Cloud Scheduler's Google token, or a shared secret on Contabo. */
export interface JobAuth {
  verify(headers: Record<string, string | string[] | undefined>): Promise<boolean>;
}
