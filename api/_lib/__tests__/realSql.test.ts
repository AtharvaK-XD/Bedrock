import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The backend's real SQL (routes, quota, log cleanup, security log) against a real Postgres engine:
// PGlite, in memory, with every db/migrations/*.up.sql applied. Only auth and the rate limiter are mocked.
// Catches API <-> schema drift that the mocked-database tests cannot see.
// Optional: skipped unless the dev package is installed (npm i -D -E @electric-sql/pglite@0.3.15).
// Limits: PGlite has one connection, so lock behavior under true parallel load is not tested here
// (that is the Neon dev-branch run, OPEN-0013).

const h = vi.hoisted(() => ({ state: { db: null as any, user: null as any } }));

// Neon's tagged template -> PGlite query with $1..$n. int8 and numeric stay strings, as Neon returns them.
vi.mock('@neondatabase/serverless', () => ({
  neon: () => (strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0];
    for (let i = 1; i < strings.length; i++) text += `$${i}${strings[i]}`;
    return h.state.db
      .query(text, values, { parsers: { 20: (v: string) => v, 1700: (v: string) => v } })
      .then((r: { rows: unknown[] }) => r.rows);
  },
}));
vi.mock('../auth.js', () => ({ authenticateRequest: vi.fn(async () => h.state.user) }));
vi.mock('../rateLimiter.js', () => ({
  enforceRateLimit: vi.fn(async () => true),
  getClientIp: () => '203.0.113.7',
  getRedisClient: () => null,
}));

import prompts from '../../prompts/index.js';
import workflows from '../../workflows/index.js';
import traces from '../../traces/index.js';
import profile from '../../user/profile.js';
import { reserveQuota, releaseQuota } from '../security.js';
import { logSecurityEvent } from '../db.js';

const PGLITE_PACKAGE = '@electric-sql/pglite';
let PGlite: any = null;
try {
  ({ PGlite } = await import(/* @vite-ignore */ PGLITE_PACKAGE));
} catch {
  PGlite = null;
}

const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../db/migrations');
const CRON_SECRET = 'real-sql-test-cron-secret';

/** Same split as db/migrate.mjs. CONCURRENTLY is dropped because PGlite has one connection (as in CHG-0015). */
async function applyMigrations(db: any) {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.up.sql')).sort();
  for (const file of files) {
    const text = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const statements = text
      .split(/^\s*-- migrate:break\s*$/m)
      .map((s) => s.trim())
      .filter((s) => s && !/^(--[^\n]*\n?)+$/.test(s));
    for (const stmt of statements) await db.exec(stmt.replace(/\bCONCURRENTLY\b/g, ''));
  }
  return files;
}

const q = async (text: string, params: unknown[] = []) => (await h.state.db.query(text, params)).rows as any[];

function as(userId: string) {
  h.state.user = {
    id: userId, email: `${userId}@example.com`, name: 'Test User', role: 'r',
    plan: 'Free Plan', subscriptionTier: 'free', isGuest: false,
  };
  return h.state.user;
}

function mockRes() {
  const res: any = { statusCode: 200, body: undefined };
  res.status = vi.fn((c: number) => ((res.statusCode = c), res));
  res.json = vi.fn((b: unknown) => ((res.body = b), res));
  res.setHeader = vi.fn();
  return res;
}

async function call(handler: (req: any, res: any) => unknown, method: string, body: unknown = {}, query: Record<string, string> = {}, headers: Record<string, string> = {}) {
  const res = mockRes();
  await handler({ method, body, query, headers }, res);
  return res;
}

describe.skipIf(!PGlite)('backend SQL on a real Postgres engine (PGlite + all migrations)', () => {
  beforeAll(async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://pglite-in-memory');
    vi.stubEnv('CRON_SECRET', CRON_SECRET);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    h.state.db = new PGlite();
    const files = await applyMigrations(h.state.db);
    expect(files.length).toBeGreaterThanOrEqual(10);
    for (const [id, username] of [['user_A', 'alice'], ['user_B', null], ['user_C', null], ['user_D', null], ['user_E', null]]) {
      await q(
        `INSERT INTO "User" (id, email, password_hash, name, username, updated_at) VALUES ($1, $2, 'x', 'Test User', $3, now())`,
        [id, `${id}@example.com`, username]
      );
    }
  }, 120_000);

  afterAll(async () => {
    await h.state.db?.close?.();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('prompts: only the owner can change or delete a prompt; another user with the same id gets 409', async () => {
    as('user_A');
    expect((await call(prompts, 'POST', { id: 'prm_shared', title: 'A', fullContent: 'alice text' })).statusCode).toBe(200);

    as('user_B');
    const hijack = await call(prompts, 'POST', { id: 'prm_shared', title: 'B', fullContent: 'hijacked' });
    expect(hijack.statusCode).toBe(409);
    expect(hijack.body.code).toBe('PROMPT_ID_CONFLICT');
    expect(await call(prompts, 'GET')).toMatchObject({ statusCode: 200, body: [] });
    await call(prompts, 'DELETE', {}, { id: 'prm_shared' });

    const [row] = await q(`SELECT user_id, full_content FROM "Prompt" WHERE id = 'prm_shared'`);
    expect(row).toEqual({ user_id: 'user_A', full_content: 'alice text' });

    as('user_A');
    expect((await call(prompts, 'POST', { id: 'prm_shared', title: 'A2', fullContent: 'alice v2' })).statusCode).toBe(200);
    const list = await call(prompts, 'GET');
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ id: 'prm_shared', title: 'A2', fullContent: 'alice v2', tags: ['Custom'] });
  });

  it('prompts: the 2,000-prompt limit gives 409 PROMPT_LIMIT_REACHED, and editing at the limit still works', async () => {
    await q(`
      INSERT INTO "Prompt" (id, user_id, title, snippet, full_content, tags, target_type, created_at, updated_at)
      SELECT 'cap_' || g, 'user_C', 't', 's', 'c', '[]', 'General', now(), now() FROM generate_series(1, 1999) g
    `);
    as('user_C');
    expect((await call(prompts, 'POST', { title: 'number 2000', fullContent: 'x' })).statusCode).toBe(200);
    const over = await call(prompts, 'POST', { title: 'number 2001', fullContent: 'x' });
    expect(over.statusCode).toBe(409);
    expect(over.body.code).toBe('PROMPT_LIMIT_REACHED');
    expect((await call(prompts, 'POST', { id: 'cap_1', title: 'edited', fullContent: 'x' })).statusCode).toBe(200);
    expect((await q(`SELECT count(*)::int AS n FROM "Prompt" WHERE user_id = 'user_C'`))[0].n).toBe(2000);
  });

  it("workflows: another user's id gives 409 WORKFLOW_ID_CONFLICT and the owner's workflow is unchanged", async () => {
    as('user_A');
    expect((await call(workflows, 'POST', { id: 'wf_shared', title: 'A', nodes: [{ id: 'n1' }], edges: [] })).statusCode).toBe(200);
    as('user_B');
    const hijack = await call(workflows, 'POST', { id: 'wf_shared', title: 'B', nodes: [], edges: [] });
    expect(hijack.statusCode).toBe(409);
    expect(hijack.body.code).toBe('WORKFLOW_ID_CONFLICT');
    const [row] = await q(`SELECT user_id, nodes FROM "BranchingTree" WHERE id = 'wf_shared'`);
    expect(row).toEqual({ user_id: 'user_A', nodes: JSON.stringify([{ id: 'n1' }]) });
  });

  it('profile: the column list matches the real User table, and a username taken in any letter case gives 409', async () => {
    as('user_A');
    const mine = await call(profile, 'GET');
    expect(mine.statusCode).toBe(200);
    expect(mine.body).toMatchObject({ id: 'user_A', username: 'alice', email: 'user_A@example.com' });
    expect(JSON.stringify(mine.body)).not.toContain('password');

    as('user_B');
    const taken = await call(profile, 'PUT', { username: 'ALICE' });
    expect(taken.statusCode).toBe(409);
    expect(taken.body.code).toBe('PROFILE_VALUE_TAKEN');
    expect((await call(profile, 'PUT', { username: 'bob', website: 'https://bob.dev' })).statusCode).toBe(200);
    expect((await q(`SELECT username, website FROM "User" WHERE id = 'user_B'`))[0]).toEqual({ username: 'bob', website: 'https://bob.dev' });
  });

  it('traces: dashboard totals cover all 150 runs through trace_totals(), the list shows the last 100', async () => {
    // latency 1..150 ms; every 10th run ERR, the rest 'OK' or 'success'; two models
    await q(`
      INSERT INTO "Trace" (id, user_id, node_origin, model_target, tokens_used, latency_ms, status, created_at)
      SELECT 'trc_' || g, 'user_D', 'n', CASE WHEN g % 3 = 0 THEN 'model-x' ELSE 'model-y' END, 10, g,
             CASE WHEN g % 10 = 0 THEN 'ERR' WHEN g % 2 = 0 THEN 'success' ELSE 'OK' END,
             now() - (g || ' seconds')::interval
      FROM generate_series(1, 150) g
    `);
    as('user_D');
    const res = await call(traces, 'GET');
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      totalInferences: 150,
      totalTokens: 1500,
      avgLatency: 76, // round(75.5)
      p99Latency: 149, // percentile_disc(0.99) of 1..150
      reliability: 90, // 135 of 150 OK/success
      activeModelsCount: 2,
    });
    expect(res.body.traces).toHaveLength(100);
    expect(res.body.traces[0].latency).toBe(1); // newest first
  });

  it('quota: exactly 10 of 15 simultaneous free generations are allowed; a refund frees one place', async () => {
    const user = as('user_E');
    const reserve = () => reserveQuota({ bucket: 'generation', endpoint: '/api/ai/synthesize', user, ip: '203.0.113.9' });
    const results = await Promise.all(Array.from({ length: 15 }, reserve));
    expect(results.filter((r) => r.allowed)).toHaveLength(10);
    expect(results.every((r) => r.store === 'QuotaEvent' || !r.allowed)).toBe(true);
    expect((await q(`SELECT count(*)::int AS n FROM "QuotaEvent" WHERE user_id = 'user_E'`))[0].n).toBe(10);

    expect((await reserve()).allowed).toBe(false);
    await releaseQuota(results.find((r) => r.allowed));
    expect((await reserve()).allowed).toBe(true);

    // Anonymous callers are counted per IP, separately from signed-in users
    const anon = await reserveQuota({ bucket: 'generation', endpoint: '/api/ai/synthesize', user: null, ip: '198.51.100.1' });
    expect(anon).toMatchObject({ allowed: true, store: 'QuotaEvent' });
  });

  it('security log: over-long values are cut and stored; the same row uncut is refused by migration 0005', async () => {
    const long = { message: 'm'.repeat(5000), ip: '1'.repeat(100), endpoint: '/e'.repeat(300) };
    await expect(
      q(`INSERT INTO "SecurityLog" (id, event_type, ip_address, endpoint, message) VALUES ('raw_long', 'UNIT_RAW', $1, $2, $3)`, [long.ip, long.endpoint, long.message])
    ).rejects.toMatchObject({ code: '23514' });

    await logSecurityEvent({ eventType: 'UNIT_LONG', message: long.message, ipAddress: long.ip, endpoint: long.endpoint });
    const rows = await q(`SELECT length(message) AS m, length(ip_address) AS i, length(endpoint) AS e FROM "SecurityLog" WHERE event_type = 'UNIT_LONG'`);
    expect(rows).toEqual([{ m: 2000, i: 64, e: 200 }]);
  });

  it('log cleanup: removes old quota rows, old logs and 90-day-old traces, keeps recent ones', async () => {
    await q(`INSERT INTO "QuotaEvent" (id, user_id, ip_address, bucket, created_at) VALUES
      ('qe_old', 'user_B', '1.1.1.1', 'generation', clock_timestamp() - interval '2 days'),
      ('qe_new', 'user_B', '1.1.1.1', 'generation', clock_timestamp())`);
    await q(`INSERT INTO "SecurityLog" (id, event_type, message, created_at) VALUES
      ('sl_old', 'AUTH_X', 'old', (now() AT TIME ZONE 'UTC') - interval '100 days'),
      ('sl_quota_old', 'AI_QUOTA_GENERATION', 'old quota', (now() AT TIME ZONE 'UTC') - interval '2 days'),
      ('sl_new', 'AUTH_X', 'new', (now() AT TIME ZONE 'UTC'))`);
    await q(`INSERT INTO "Trace" (id, user_id, node_origin, model_target, tokens_used, latency_ms, status, created_at) VALUES
      ('trc_old', 'user_B', 'n', 'm', 1, 1, 'OK', (now() AT TIME ZONE 'UTC') - interval '100 days'),
      ('trc_new', 'user_B', 'n', 'm', 1, 1, 'OK', (now() AT TIME ZONE 'UTC'))`);

    const res = await call(traces, 'GET', {}, { action: 'purge-logs' }, { authorization: `Bearer ${CRON_SECRET}` });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ success: true, finished: true });

    const left = (await q(`
      SELECT id FROM "QuotaEvent" WHERE id LIKE 'qe_%'
      UNION ALL SELECT id FROM "SecurityLog" WHERE id LIKE 'sl_%'
      UNION ALL SELECT id FROM "Trace" WHERE id LIKE 'trc_old' OR id = 'trc_new'
    `)).map((r) => r.id).sort();
    expect(left).toEqual(['qe_new', 'sl_new', 'trc_new']);
  });
});
