/**
 * XP is stored as whole units so fractions add up exactly: 2,400 units = 1 XP.
 * 2,400 is divisible by 24 (a tap) and by 100 (two-decimal display), so both
 * stay exact.
 */
export const XP_UNITS_PER_XP = 2400;

/**
 * A tap earns 1/24 XP (founder decision 2026-10-06): 24 taps in a day, or one
 * auto-streak day, earn exactly 1 XP. An auto-streak hour pays the same, never more.
 */
export const TAP_XP_UNITS = XP_UNITS_PER_XP / 24;

/**
 * XP for display, rounded toward zero to two decimals: one tap (0.0417 XP)
 * shows as "0.04" and 24 taps show as "1.00". Ranking always uses the exact units.
 */
export function formatXp(units: number | bigint): string {
  const exact = BigInt(units);
  const negative = exact < 0n;
  const hundredths = ((negative ? -exact : exact) * 100n) / BigInt(XP_UNITS_PER_XP);
  const whole = hundredths / 100n;
  const fraction = (hundredths % 100n).toString().padStart(2, '0');
  return `${negative && hundredths > 0n ? '-' : ''}${whole}.${fraction}`;
}
