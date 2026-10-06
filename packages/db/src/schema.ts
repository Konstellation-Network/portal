import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

// Case-insensitive text, so "Ada" and "ada" are the same username.
const citext = customType<{ data: string }>({ dataType: () => 'citext' });
const bytea = customType<{ data: Uint8Array }>({ dataType: () => 'bytea' });
const at = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const big = (name: string) => bigint(name, { mode: 'number' });

// ---------- identity ----------

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    decaneUserId: text('decane_user_id').notNull().unique(),
    // Lowercase hex, resolved from Decane on the server, never sent by the client.
    evmAddress: text('evm_address').notNull().unique(),
    username: citext('username').unique(),
    usernameSetAt: at('username_set_at'),
    // Seconds into the hour this user's windows open (core/windows.ts).
    tapOffsetS: integer('tap_offset_s').notNull(),
    role: text('role').notNull().default('user'),
    status: text('status').notNull().default('active'),
    createdAt: at('created_at').notNull().defaultNow(),
  },
  (t) => [
    check('users_evm_address_format', sql`${t.evmAddress} ~ '^0x[0-9a-f]{40}$'`),
    // citext matches case-insensitively: letters, digits and _, 3 to 20 long.
    check('users_username_format', sql`${t.username} ~ '^[a-z0-9_]{3,20}$'`),
    check('users_tap_offset_range', sql`${t.tapOffsetS} between 0 and 3599`),
    check('users_role', sql`${t.role} in ('user', 'admin')`),
    check('users_status', sql`${t.status} in ('active', 'banned')`),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    // Every rotation of one sign-in; a spent token used again revokes the family.
    familyId: uuid('family_id').notNull(),
    tokenHash: bytea('token_hash').notNull().unique(),
    expiresAt: at('expires_at').notNull(),
    rotatedAt: at('rotated_at'),
    revokedAt: at('revoked_at'),
    ipHmac: bytea('ip_hmac'),
    uaHmac: bytea('ua_hmac'),
    createdAt: at('created_at').notNull().defaultNow(),
  },
  (t) => [index('sessions_user_idx').on(t.userId), index('sessions_family_idx').on(t.familyId)],
);

// ---------- XP ----------

export const seasons = pgTable('seasons', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  startsAt: at('starts_at').notNull(),
  endsAt: at('ends_at'),
});

/** Append-only. Written only by awardXp(); amounts are XP units (2,400 = 1 XP). */
export const xpEvents = pgTable(
  'xp_events',
  {
    id: big('id').primaryKey().generatedAlwaysAsIdentity(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    seasonId: integer('season_id')
      .notNull()
      .references(() => seasons.id),
    amount: integer('amount').notNull(),
    // 'tap' | 'auto_streak' | 'admin'; later 'quest', 'referral'.
    source: text('source').notNull(),
    sourceRef: text('source_ref').notNull(),
    idempotencyKey: text('idempotency_key').notNull().unique(),
    reversesId: big('reverses_id').references((): AnyPgColumn => xpEvents.id),
    actorId: uuid('actor_id').references(() => users.id),
    createdAt: at('created_at').notNull().defaultNow(),
  },
  (t) => [
    check('xp_events_amount_nonzero', sql`${t.amount} <> 0`),
    index('xp_events_user_season_idx').on(t.userId, t.seasonId),
  ],
);

/** Running total per season, updated in the same transaction as each xp_events row. */
export const userXp = pgTable(
  'user_xp',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    seasonId: integer('season_id')
      .notNull()
      .references(() => seasons.id),
    xp: big('xp').notNull().default(0),
    reachedAt: at('reached_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.seasonId] }),
    index('user_xp_rank_idx').on(t.seasonId, t.xp.desc(), t.reachedAt),
  ],
);

// ---------- taps and streaks ----------

export const taps = pgTable(
  'taps',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    windowIdx: big('window_idx').notNull(),
    // XP units; a tap is 100 (1/24 XP).
    xp: integer('xp').notNull(),
    source: text('source').notNull().default('tap'),
    // Kept for sybil analysis; HMACs, never raw values.
    ipHmac: bytea('ip_hmac'),
    uaHmac: bytea('ua_hmac'),
    createdAt: at('created_at').notNull().defaultNow(),
  },
  (t) => [
    // One tap per window, whether the user tapped or the auto-streak filled it.
    primaryKey({ columns: [t.userId, t.windowIdx] }),
    check('taps_source', sql`${t.source} in ('tap', 'auto_streak')`),
  ],
);

/** A count of covered hours; it never resets (founder decision 2026-10-01). */
export const streaks = pgTable('streaks', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id),
  current: integer('current').notNull().default(0),
  lastWindow: big('last_window'),
});

// ---------- store and money (amounts in kobo) ----------

export const products = pgTable(
  'products',
  {
    sku: text('sku').primaryKey(),
    name: text('name').notNull(),
    priceKobo: big('price_kobo').notNull(),
    active: boolean('active').notNull().default(true),
    config: jsonb('config').notNull().default({}),
  },
  (t) => [check('products_price_positive', sql`${t.priceKobo} > 0`)],
);

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    sku: text('sku')
      .notNull()
      .references(() => products.sku),
    priceKobo: big('price_kobo').notNull(),
    status: text('status').notNull(),
    idempotencyKey: text('idempotency_key').notNull().unique(),
    createdAt: at('created_at').notNull().defaultNow(),
  },
  (t) => [
    check('orders_status', sql`${t.status} in ('paid', 'refunded')`),
    index('orders_user_idx').on(t.userId),
  ],
);

/** One auto-streak: 24 windows, one active per user at a time. */
export const streakShields = pgTable(
  'streak_shields',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    orderId: uuid('order_id')
      .notNull()
      .unique()
      .references(() => orders.id),
    startWindow: big('start_window').notNull(),
    endWindow: big('end_window').notNull(),
  },
  (t) => [
    check('streak_shields_range', sql`${t.endWindow} >= ${t.startWindow}`),
    index('streak_shields_user_end_idx').on(t.userId, t.endWindow),
  ],
);

export const pouchCustomers = pgTable('pouch_customers', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id),
  customerId: text('customer_id').notNull().unique(),
  virtualAccountId: text('virtual_account_id').notNull().unique(),
  accountNumber: text('account_number').notNull(),
  bankName: text('bank_name').notNull(),
  accountName: text('account_name').notNull(),
  createdAt: at('created_at').notNull().defaultNow(),
});

/** Append-only. Keys like 'pouch:transfer:<id>' and 'order:<id>' stop double credits. */
export const fiatLedger = pgTable(
  'fiat_ledger',
  {
    id: big('id').primaryKey().generatedAlwaysAsIdentity(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    amountKobo: big('amount_kobo').notNull(),
    kind: text('kind').notNull(),
    ref: text('ref').notNull(),
    idempotencyKey: text('idempotency_key').notNull().unique(),
    createdAt: at('created_at').notNull().defaultNow(),
  },
  (t) => [
    check('fiat_ledger_amount_nonzero', sql`${t.amountKobo} <> 0`),
    check('fiat_ledger_kind', sql`${t.kind} in ('topup', 'purchase', 'refund', 'adjustment')`),
    index('fiat_ledger_user_idx').on(t.userId),
  ],
);

export const fiatBalances = pgTable(
  'fiat_balances',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id),
    balanceKobo: big('balance_kobo').notNull().default(0),
  },
  (t) => [check('fiat_balances_not_negative', sql`${t.balanceKobo} >= 0`)],
);

export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: big('id').primaryKey().generatedAlwaysAsIdentity(),
    provider: text('provider').notNull(),
    // Event name + the object's id; a redelivery is ignored.
    eventKey: text('event_key').notNull(),
    payload: jsonb('payload').notNull(),
    receivedAt: at('received_at').notNull().defaultNow(),
    processedAt: at('processed_at'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
  },
  (t) => [unique('webhook_events_provider_event_key').on(t.provider, t.eventKey)],
);

// ---------- operations ----------

export const config = pgTable('config', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedBy: uuid('updated_by').references(() => users.id),
  updatedAt: at('updated_at').notNull().defaultNow(),
});

export const auditLog = pgTable('audit_log', {
  id: big('id').primaryKey().generatedAlwaysAsIdentity(),
  actorId: uuid('actor_id').references(() => users.id),
  action: text('action').notNull(),
  target: text('target'),
  data: jsonb('data'),
  createdAt: at('created_at').notNull().defaultNow(),
});
