import { describe, expect, it } from 'vitest';
import { formatXp, TAP_XP_UNITS, XP_UNITS_PER_XP } from './xp.ts';

describe('XP units', () => {
  it('pays exactly 1 XP for a full day of taps', () => {
    expect(TAP_XP_UNITS * 24).toBe(XP_UNITS_PER_XP);
    expect(Number.isInteger(TAP_XP_UNITS)).toBe(true);
  });

  it('shows one tap as 0.04 XP and a day as 1.00 XP', () => {
    expect(formatXp(TAP_XP_UNITS)).toBe('0.04');
    expect(formatXp(TAP_XP_UNITS * 24)).toBe('1.00');
    expect(formatXp(TAP_XP_UNITS * 36)).toBe('1.50');
  });

  it('formats zero, bigints and reversals', () => {
    expect(formatXp(0)).toBe('0.00');
    expect(formatXp(10n ** 12n)).toBe('416666666.66');
    expect(formatXp(-XP_UNITS_PER_XP)).toBe('-1.00');
  });
});
