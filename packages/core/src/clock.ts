/**
 * Every rule reads time through a Clock, so tests can fix it. In production the
 * tap transaction reads `now()` from Postgres instead, so every API instance
 * shares one clock.
 */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

export interface FixedClock extends Clock {
  set(at: Date | string): void;
  advance(ms: number): void;
}

export function fixedClock(at: Date | string): FixedClock {
  let current = new Date(at);
  return {
    now: () => new Date(current),
    set: (next) => {
      current = new Date(next);
    },
    advance: (ms) => {
      current = new Date(current.getTime() + ms);
    },
  };
}
