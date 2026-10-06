import { randomInt } from 'node:crypto';

/**
 * Hour windows. Each user gets a fixed offset at signup, so their hours start at
 * a different minute from everyone else's: taps and "your tap is ready" notices
 * spread across the hour instead of landing at :00. One tap per window is
 * enforced by the database (taps primary key).
 */
export const WINDOW_SECONDS = 3600;

export function assertTapOffset(tapOffsetS: number): void {
  if (!Number.isInteger(tapOffsetS) || tapOffsetS < 0 || tapOffsetS >= WINDOW_SECONDS) {
    throw new RangeError(
      `tap offset must be an integer in [0, ${WINDOW_SECONDS}), got ${tapOffsetS}`,
    );
  }
}

/** A new user's offset, uniform over the hour. */
export function newTapOffset(): number {
  return randomInt(0, WINDOW_SECONDS);
}

/** The window `at` falls in: floor((unix seconds − offset) / 3600). */
export function windowIndex(at: Date, tapOffsetS: number): number {
  assertTapOffset(tapOffsetS);
  const seconds = Math.floor(at.getTime() / 1000);
  return Math.floor((seconds - tapOffsetS) / WINDOW_SECONDS);
}

/** When window `index` opens for this user. */
export function windowStart(index: number, tapOffsetS: number): Date {
  assertTapOffset(tapOffsetS);
  return new Date((index * WINDOW_SECONDS + tapOffsetS) * 1000);
}

/** When this user's next window opens after `at`; the API returns it as next_tap_at. */
export function nextTapAt(at: Date, tapOffsetS: number): Date {
  return windowStart(windowIndex(at, tapOffsetS) + 1, tapOffsetS);
}
