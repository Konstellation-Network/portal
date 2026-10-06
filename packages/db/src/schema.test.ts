import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrationsFolder } from './migrate.ts';

/**
 * Applies every migration to an empty database, then proves the rules the
 * schema enforces on its own. CI runs this against a real Postgres
 * (DATABASE_URL); without one it uses PGlite, Postgres compiled to WebAssembly,
 * so it also runs on a laptop with no Docker.
 */
interface TestDb {
  query(text: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
  close(): Promise<void>;
}

async function openTestDb(): Promise<TestDb> {
  const url = process.env['DATABASE_URL'];
  if (url) {
    const { runMigrations } = await import('./migrate.ts');
    await runMigrations(url);
    const postgres = (await import('postgres')).default;
    const sql = postgres(url, { max: 2, onnotice: () => {} });
    return {
      query: async (text, params = []) =>
        (await sql.unsafe(text, params as never[])) as unknown as Record<string, unknown>[],
      close: () => sql.end(),
    };
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const { citext } = await import('@electric-sql/pglite/contrib/citext');
  const { drizzle } = await import('drizzle-orm/pglite');
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  const pg = new PGlite({ extensions: { citext } });
  await migrate(drizzle(pg), { migrationsFolder });
  return {
    query: async (text, params = []) =>
      (await pg.query<Record<string, unknown>>(text, params)).rows,
    close: () => pg.close(),
  };
}

let db: TestDb;
beforeAll(async () => {
  db = await openTestDb();
}, 60_000);
afterAll(async () => {
  await db?.close();
});

const address = () => `0x${randomBytes(20).toString('hex')}`;
async function newUser(username: string | null = null): Promise<string> {
  const [row] = await db.query(
    `insert into users (decane_user_id, evm_address, username, tap_offset_s)
     values ($1, $2, $3, $4) returning id`,
    [randomUUID(), address(), username, 600],
  );
  return row?.['id'] as string;
}

const VIOLATION = /duplicate key|violates check constraint|violates unique constraint/;

describe('schema', () => {
  it('creates all sixteen tables', async () => {
    const rows = await db.query(
      `select table_name from information_schema.tables
       where table_schema = 'public' and table_type = 'BASE TABLE'`,
    );
    expect(rows.map((r) => r['table_name']).sort()).toEqual(
      [
        'audit_log',
        'config',
        'fiat_balances',
        'fiat_ledger',
        'orders',
        'pouch_customers',
        'products',
        'seasons',
        'sessions',
        'streak_shields',
        'streaks',
        'taps',
        'user_xp',
        'users',
        'webhook_events',
        'xp_events',
      ].sort(),
    );
  });

  it('allows one tap per window', async () => {
    const user = await newUser();
    const tap = `insert into taps (user_id, window_idx, xp) values ($1, $2, 100)`;
    await db.query(tap, [user, 500_000]);
    await expect(db.query(tap, [user, 500_000])).rejects.toThrow(VIOLATION);
    await db.query(tap, [user, 500_001]);
  });

  it('accepts only known tap sources', async () => {
    const user = await newUser();
    await expect(
      db.query(`insert into taps (user_id, window_idx, xp, source) values ($1, 1, 100, 'bonus')`, [
        user,
      ]),
    ).rejects.toThrow(VIOLATION);
  });

  it('treats usernames as equal regardless of case', async () => {
    const name = `ada_${randomBytes(4).toString('hex')}`;
    await newUser(name);
    await expect(newUser(name.toUpperCase())).rejects.toThrow(VIOLATION);
  });

  it('refuses usernames outside the allowed form', async () => {
    await expect(newUser('ab')).rejects.toThrow(VIOLATION);
    await expect(newUser('no spaces')).rejects.toThrow(VIOLATION);
  });

  it('stores addresses as lowercase hex only', async () => {
    await expect(
      db.query(`insert into users (decane_user_id, evm_address, tap_offset_s) values ($1, $2, 0)`, [
        randomUUID(),
        address().toUpperCase().replace('0X', '0x'),
      ]),
    ).rejects.toThrow(VIOLATION);
  });

  it('never lets a balance go below zero', async () => {
    const user = await newUser();
    await db.query(`insert into fiat_balances (user_id, balance_kobo) values ($1, 100)`, [user]);
    await expect(
      db.query(`update fiat_balances set balance_kobo = balance_kobo - 101 where user_id = $1`, [
        user,
      ]),
    ).rejects.toThrow(VIOLATION);
  });

  it('credits a transfer once, whatever the redeliveries', async () => {
    const user = await newUser();
    const credit = `insert into fiat_ledger (user_id, amount_kobo, kind, ref, idempotency_key)
                    values ($1, 150000, 'topup', 'transfer', $2)`;
    const key = `pouch:transfer:${randomUUID()}`;
    await db.query(credit, [user, key]);
    await expect(db.query(credit, [user, key])).rejects.toThrow(VIOLATION);
  });

  it('records each XP award once per idempotency key', async () => {
    const user = await newUser();
    await db.query(
      `insert into seasons (id, name, starts_at) values (1, 'Season 1', now()) on conflict do nothing`,
    );
    const award = `insert into xp_events (user_id, season_id, amount, source, source_ref, idempotency_key)
                   values ($1, 1, 100, 'tap', 'w', $2)`;
    const key = `tap:${user}:500000`;
    await db.query(award, [user, key]);
    await expect(db.query(award, [user, key])).rejects.toThrow(VIOLATION);
  });
});
