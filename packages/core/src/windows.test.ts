import { describe, expect, it } from 'vitest';
import { fixedClock } from './clock.ts';
import { newTapOffset, nextTapAt, windowIndex, windowStart, WINDOW_SECONDS } from './windows.ts';

describe('hour windows', () => {
  it('starts a window at the user offset, not at :00', () => {
    const offset = 25 * 60; // windows open at :25
    const at = new Date('2026-10-06T10:24:59Z');
    const later = new Date('2026-10-06T10:25:00Z');
    expect(windowIndex(later, offset)).toBe(windowIndex(at, offset) + 1);
    expect(windowStart(windowIndex(later, offset), offset)).toEqual(later);
  });

  it('gives one window per hour, for every offset', () => {
    for (const offset of [0, 1, 1799, 3599]) {
      const clock = fixedClock('2026-10-06T00:00:00Z');
      const first = windowIndex(clock.now(), offset);
      clock.advance(WINDOW_SECONDS * 1000);
      expect(windowIndex(clock.now(), offset)).toBe(first + 1);
    }
  });

  it('opens the next tap exactly one window after the current one opened', () => {
    const offset = 600;
    const at = new Date('2026-10-06T10:40:00Z');
    expect(nextTapAt(at, offset)).toEqual(new Date('2026-10-06T11:10:00Z'));
  });

  it('refuses an offset outside the hour', () => {
    expect(() => windowIndex(new Date(), -1)).toThrow(RangeError);
    expect(() => windowIndex(new Date(), WINDOW_SECONDS)).toThrow(RangeError);
    expect(() => windowIndex(new Date(), 1.5)).toThrow(RangeError);
  });

  it('draws offsets inside the hour', () => {
    for (let i = 0; i < 1000; i++) {
      const offset = newTapOffset();
      expect(offset).toBeGreaterThanOrEqual(0);
      expect(offset).toBeLessThan(WINDOW_SECONDS);
    }
  });
});
