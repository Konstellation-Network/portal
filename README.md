# Portal

The Konstellation user app. Users sign in with Google through Decane Kit and get
an embedded wallet. They tap once an hour for 1/24 XP, build a streak that never
resets, climb a public leaderboard, and can buy a one-day auto-streak for $1,
paid through Pouch.

Private repo. Context: `handbook/ENGINEERING.md §6.8` and STATUS P33–P36. The
full design is the "Portal — MVP Architecture" doc.

## Shape

A modular monolith: one API service and one Postgres database, behind
Cloudflare, plus a static web app. Every business rule lives in
`packages/core`; the API turns HTTP into calls to it, and the mobile app will
call the same API.

```
apps/api/            Fastify v1 API, webhooks, job routes, migrate command
apps/web/            the user app (Vite + React), static on Cloudflare Pages
  functions/api/     Pages Function forwarding /api to the API (no domain yet)
packages/core/       business rules: hour windows, XP units, clock
packages/db/         Drizzle schema, SQL migrations, client
packages/adapters/   Decane, Pouch, rate limits, job auth behind interfaces
packages/config/     environment parsing
packages/sdk/        API client generated from apps/api/openapi.json
```

## Run it locally

Needs Node 24 (`.nvmrc`). Postgres from `compose.yaml` needs Docker; the tests
do not (they fall back to PGlite, Postgres in WebAssembly).

```sh
npm ci
npm test                       # unit + schema tests, no Docker needed

docker compose up -d           # local Postgres on 127.0.0.1:5432
cp .env.example apps/api/.env
npm run db:migrate
npm run dev:api                # http://localhost:8080/healthz
npm run dev:web                # http://localhost:5173, /api proxied to the API
```

## Day to day

| Command                           | Does                                                                |
| --------------------------------- | ------------------------------------------------------------------- |
| `npm run typecheck`               | Type-check server (Node) and web (DOM) code                         |
| `npm run lint` / `npm run format` | ESLint / Prettier                                                   |
| `npm run db:generate`             | Write a migration for schema changes in `packages/db/src/schema.ts` |
| `npm run openapi`                 | Regenerate `apps/api/openapi.json` and the SDK types                |
| `npm run secret-scan`             | Scan all history for committed credentials                          |

CI runs all of these, applies migrations to a real Postgres, checks the
committed spec, SDK and migrations are current, and builds the API image.

## Rules that keep the foundation clean

- **XP is written only by `awardXp()`**, into the append-only `xp_events`
  ledger. Amounts are whole units: 2,400 = 1 XP, so a tap (1/24 XP) is 100.
- **Payments never write XP.** Money buys an auto-streak shield; Streaks awards
  the XP. ESLint enforces the boundary.
- **The database enforces the rules that matter**: one tap per window, no
  negative balance, one credit per transfer, one XP award per key.
- **Platform is configuration.** The same image runs on GCP (Cloud Run + Cloud
  SQL) or Contabo; only job auth, rate limits and the database connection
  differ (STATUS P33).
- **Migrations only add.** Removals ship a release later, so a rollback never
  meets a schema it cannot read.

## Milestones

| #   | Milestone                            |
| --- | ------------------------------------ |
| 0   | Foundations (this): repo, CI, schema |
| 1   | Sign-in with Decane                  |
| 2   | Hourly tap and streak                |
| 3   | Leaderboard                          |
| 4   | Pouch payments and the auto-streak   |
| 5   | Admin and operations                 |
| 6   | Hardening and launch                 |
