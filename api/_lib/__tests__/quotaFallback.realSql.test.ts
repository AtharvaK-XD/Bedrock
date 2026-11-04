import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The quota fallback's real SQL on a real Postgres engine (PGlite), on a database WITHOUT migration 0004: only the
// baseline is applied, so reserve_quota() really is missing, the state of a database that was not migrated yet.
// Limit: PGlite has one connection, so this proves the SQL and the counting, not behavior under true parallel load
// (agent-sync/quota-race-proof.mjs does that on the Neon dev branch).

const h = vi.hoisted(() => ({ state: { db: null as any } }));

const PARSERS = { parsers: { 20: (v: string) => v, 1700: (v: string) => v } };

// Neon's lazy tagged template + sql.transaction() -> PGlite
vi.mock('@neondatabase/serverless', () => ({
  neon: () => {
    const sql: any = (strings: TemplateStringsArray, ...values: unknown[]) => {
      let text = strings[0];
      for (let i = 1; i < strings.length; i++) text += `$${i}${strings[i]}`;
      return {
        text,
        values,
        then: (ok: (rows: unknown[]) => unknown, fail: (e: unknown) => unknown) =>
          h.state.db.query(text, values, PARSERS).then((r: { rows: unknown[] }) => r.rows).then(ok, fail),
      };
    };
    sql.transaction = (queries: Array<{ text: string; values: unknown[] }>) =>
      h.state.db.transaction(async (tx: any) => {
        const out: unknown[] = [];
        for (const q of queries) out.push((await tx.query(q.text, q.values, PARSERS)).rows);
        return out;
      });
    return sql;
  },
}));

import { reserveQuota, releaseQuota } from '../security.js';

const PGLITE_PACKAGE = '@electric-sql/pglite';
let PGlite: any = null;
try {
  ({ PGlite } = await import(/* @vite-ignore */ PGLITE_PACKAGE));
} catch {
  PGlite = null;
}

const BASELINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../db/migrations/0001_baseline.up.sql');
const user = { id: 'user_F', email: 'f@example.com', name: 'F', role: 'r', plan: 'Free Plan', subscriptionTier: 'free', isGuest: false } as any;
const count = async (where: string) =>
  Number((await h.state.db.query(`SELECT count(*)::int AS n FROM "SecurityLog" WHERE ${where}`)).rows[0].n);

describe.skipIf(!PGlite)('quota fallback on a real Postgres engine, migration 0004 not applied', () => {
  beforeAll(async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://pglite-in-memory');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    h.state.db = new PGlite();
    await h.state.db.exec(readFileSync(BASELINE, 'utf8').replace(/^\s*-- migrate:break\s*$/gm, ''));
    await h.state.db.query(`INSERT INTO "User" (id, email, password_hash, name, updated_at) VALUES ('user_F', 'f@example.com', 'x', 'F', now())`);
  }, 120_000);

  afterAll(async () => {
    await h.state.db?.close?.();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('grants up to the limit for a signed-in user, then refuses; a refund frees one unit', async () => {
    const reserve = () => reserveQuota({ bucket: 'generation', endpoint: '/api/ai/synthesize', user, ip: '203.0.113.9' });
    const results = [];
    for (let i = 0; i < 11; i++) results.push(await reserve());

    expect(results.slice(0, 10).every((r) => r.allowed && r.store === 'SecurityLog')).toBe(true);
    expect(results[10]).toMatchObject({ allowed: false, unavailable: false, reservationId: null });
    expect(await count(`user_id = 'user_F' AND event_type = 'AI_QUOTA_GENERATION'`)).toBe(10);

    await releaseQuota(results[0]);
    expect(await count(`user_id = 'user_F' AND event_type = 'AI_QUOTA_GENERATION'`)).toBe(9);
    expect((await reserve()).allowed).toBe(true);
  });

  it('counts anonymous callers per network, including IPv6 /64 keys, separately from each other', async () => {
    const anon = (ip: string) => reserveQuota({ bucket: 'generation', endpoint: '/api/ai/synthesize', user: null, ip });
    for (let i = 0; i < 10; i++) expect((await anon('2001:db8:1:2::/64')).allowed).toBe(true);
    expect((await anon('2001:db8:1:2::/64')).allowed).toBe(false);
    expect((await anon('2001:db8:1:3::/64')).allowed).toBe(true);
  });

  it('keeps the two buckets apart', async () => {
    const q = await reserveQuota({ bucket: 'assist', endpoint: '/api/ai/refine', user, ip: '203.0.113.9' });
    expect(q).toMatchObject({ allowed: true, store: 'SecurityLog' });
  });
});
