// Database tests for migrations 0001-0010 (db/migrations).
// Runs ONLY when DATABASE_URL_DEV points at a Neon DEV branch that already has the migrations applied
// (node db/migrate.mjs up --yes). Without it every test here is skipped. It never reads DATABASE_URL.
// Before/after proof: `up --yes --to 0004` -> the 0005-0010 tests fail; `up --yes` -> they pass.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { neon } from '@neondatabase/serverless';

const url = (process.env.DATABASE_URL_DEV || '').trim().replace(/^"|"$/g, '');
const run = url ? describe : describe.skip;
const sql = url ? neon(url) : (null as unknown as ReturnType<typeof neon>);

const tag = `dbtest_${Math.random().toString(36).slice(2, 8)}`;
const userA = `${tag}_a`;
const userB = `${tag}_b`;

async function makeUser(id: string) {
  await sql`
    INSERT INTO "User" (id, email, password_hash, name, updated_at)
    VALUES (${id}, ${id + '@test.invalid'}, 'x', 'db test', NOW())
  `;
}

// Same call shape as api/_lib/security.ts (reserveViaQuotaTable)
async function reserve(id: string, user: string | null, ip: string | null, limit: number, bucket = 'generation') {
  const rows = (await sql`
    SELECT reserve_quota(${id}, ${user}::text, ${ip}, ${bucket}, '/test', ${limit}::int) AS ok
  `) as Array<{ ok: boolean }>;
  return rows[0].ok;
}

run('database migrations (dev branch only)', () => {
  beforeAll(async () => {
    await makeUser(userA);
    await makeUser(userB);
  });

  afterAll(async () => {
    await sql`DELETE FROM "QuotaEvent" WHERE id LIKE ${tag + '%'} OR user_id LIKE ${tag + '%'} OR ip_address LIKE ${tag + '%'}`;
    await sql`DELETE FROM "SecurityLog" WHERE id LIKE ${tag + '%'}`;
    await sql`DELETE FROM "User" WHERE id LIKE ${tag + '%'}`; // cascades to Prompt / Trace / BranchingTree
  });

  describe('reserve_quota (0004)', () => {
    it('grants exactly `limit` units when 20 requests arrive at the same time', async () => {
      const results = await Promise.all(
        Array.from({ length: 20 }, (_, i) => reserve(`${tag}_p${i}`, userA, `${tag}_ip`, 10)),
      );
      expect(results.filter(Boolean)).toHaveLength(10);
    }, 60_000);

    it('counts a retried reservation (same id) only once', async () => {
      expect(await reserve(`${tag}_r1`, userB, `${tag}_ip`, 1)).toBe(true);
      expect(await reserve(`${tag}_r1`, userB, `${tag}_ip`, 1)).toBe(true);
      expect(await reserve(`${tag}_r2`, userB, `${tag}_ip`, 1)).toBe(false);
    });

    it('frees a unit when the reservation row is deleted (refund)', async () => {
      await sql`DELETE FROM "QuotaEvent" WHERE id = ${tag + '_r1'}`;
      expect(await reserve(`${tag}_r3`, userB, `${tag}_ip`, 1)).toBe(true);
    });

    it('meters anonymous callers per IP, separately from users and per bucket', async () => {
      const ip = `${tag}_anon`;
      expect(await reserve(`${tag}_a1`, null, ip, 1)).toBe(true);
      expect(await reserve(`${tag}_a2`, null, ip, 1)).toBe(false);
      expect(await reserve(`${tag}_a3`, null, ip, 1, 'assist')).toBe(true);
    });
  });

  describe('ownership-safe save (pattern the API must use)', () => {
    it('does not let user B overwrite user A\'s prompt', async () => {
      const id = `${tag}_prompt`;
      await sql`
        INSERT INTO "Prompt" (id, user_id, title, snippet, full_content, tags, target_type, created_at, updated_at)
        VALUES (${id}, ${userA}, 'mine', 's', 'original', '[]', 'General', NOW(), NOW())
      `;
      const stolen = await sql`
        INSERT INTO "Prompt" (id, user_id, title, snippet, full_content, tags, target_type, created_at, updated_at)
        VALUES (${id}, ${userB}, 'hacked', 's', 'overwritten', '[]', 'General', NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title, snippet = EXCLUDED.snippet, full_content = EXCLUDED.full_content,
          tags = EXCLUDED.tags, target_type = EXCLUDED.target_type, updated_at = NOW()
        WHERE "Prompt".user_id = EXCLUDED.user_id
        RETURNING id
      `;
      expect(stolen).toHaveLength(0); // 0 rows written -> API answers 403/404
      const rows = (await sql`SELECT user_id, full_content FROM "Prompt" WHERE id = ${id}`) as any[];
      expect(rows[0]).toMatchObject({ user_id: userA, full_content: 'original' });
    });

    it('still lets the owner update their own prompt', async () => {
      const id = `${tag}_prompt`;
      const ok = await sql`
        INSERT INTO "Prompt" (id, user_id, title, snippet, full_content, tags, target_type, created_at, updated_at)
        VALUES (${id}, ${userA}, 'mine v2', 's', 'edited', '[]', 'General', NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, full_content = EXCLUDED.full_content, updated_at = NOW()
        WHERE "Prompt".user_id = EXCLUDED.user_id
        RETURNING id
      `;
      expect(ok).toHaveLength(1);
    });
  });

  describe('limits and checks (0003)', () => {
    it('rejects an oversized prompt', async () => {
      await expect(sql`
        INSERT INTO "Prompt" (id, user_id, title, snippet, full_content, tags, target_type, created_at, updated_at)
        VALUES (${tag + '_big'}, ${userA}, 't', 's', ${'x'.repeat(200_001)}, '[]', 'General', NOW(), NOW())
      `).rejects.toThrow(/Prompt_size_chk/);
    });

    it('rejects negative token / latency numbers in a trace', async () => {
      await expect(sql`
        INSERT INTO "Trace" (id, user_id, node_origin, model_target, tokens_used, latency_ms, status, created_at)
        VALUES (${tag + '_t'}, ${userA}, 'n', 'm', -5, 10, 'OK', NOW())
      `).rejects.toThrow(/Trace_sanity_chk/);
    });

    it('stops a user at 500 workflows but still lets them edit an existing one', async () => {
      await sql`
        INSERT INTO "BranchingTree" (id, user_id, title, nodes, edges, created_at, updated_at)
        SELECT ${tag + '_wf'} || g, ${userB}, 'w', '[]', '[]', NOW(), NOW() FROM generate_series(1, 500) g
      `;
      await expect(sql`
        INSERT INTO "BranchingTree" (id, user_id, title, nodes, edges, created_at, updated_at)
        VALUES (${tag + '_wf_extra'}, ${userB}, 'w', '[]', '[]', NOW(), NOW())
      `).rejects.toThrow(/ROW_LIMIT_EXCEEDED/);
      const edit = await sql`
        INSERT INTO "BranchingTree" (id, user_id, title, nodes, edges, created_at, updated_at)
        VALUES (${tag + '_wf1'}, ${userB}, 'renamed', '[]', '[]', NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title WHERE "BranchingTree".user_id = EXCLUDED.user_id
        RETURNING id
      `;
      expect(edit).toHaveLength(1);
    }, 60_000);
  });

  describe('purge_old_logs (0004)', () => {
    it('deletes expired quota rows and keeps fresh ones', async () => {
      await sql`INSERT INTO "QuotaEvent"(id, user_id, bucket, created_at) VALUES (${tag + '_old'}, ${userA}, 'generation', now() - interval '2 days')`;
      await sql`INSERT INTO "QuotaEvent"(id, user_id, bucket) VALUES (${tag + '_new'}, ${userA}, 'generation')`;
      await sql`SELECT * FROM purge_old_logs(100000)`;
      const left = (await sql`SELECT id FROM "QuotaEvent" WHERE id IN (${tag + '_old'}, ${tag + '_new'})`) as any[];
      expect(left.map((r) => r.id)).toEqual([`${tag}_new`]);
    });

    it('can be called again and again and always returns the 4 counts the cron reads', async () => {
      for (let i = 0; i < 3; i++) {
        const [row] = (await sql`SELECT * FROM purge_old_logs()`) as any[];
        expect(Object.keys(row).sort()).toEqual(['idempotency_keys', 'quota_events', 'security_logs', 'traces']);
      }
    });

    it('deletes SecurityLog rows older than 90 days in batches, keeps newer ones', async () => {
      await sql`
        INSERT INTO "SecurityLog" (id, event_type, message, created_at)
        SELECT ${tag + '_sl'} || g, 'DBTEST', 'm', (now() AT TIME ZONE 'UTC') - interval '91 days' FROM generate_series(1, 12) g
      `;
      await sql`INSERT INTO "SecurityLog" (id, event_type, message, created_at) VALUES (${tag + '_slnew'}, 'DBTEST', 'm', (now() AT TIME ZONE 'UTC') - interval '89 days')`;
      let rounds = 0;
      for (;;) {
        const [row] = (await sql`SELECT * FROM purge_old_logs(5)`) as any[];
        rounds++;
        if (row.security_logs === 0 || rounds > 1000) break;
        expect(row.security_logs).toBeLessThanOrEqual(5);
      }
      const left = (await sql`SELECT id FROM "SecurityLog" WHERE id LIKE ${tag + '_sl%'}`) as any[];
      expect(left.map((r) => r.id)).toEqual([`${tag}_slnew`]);
    }, 120_000);
  });

  describe('live schema facts the API relies on', () => {
    it('Prompt, BranchingTree, Trace have PRIMARY KEY (id) and a NOT NULL user_id with ON DELETE CASCADE', async () => {
      const rows = (await sql`
        SELECT c.conrelid::regclass::text AS tbl, c.contype, c.confdeltype, pg_get_constraintdef(c.oid) AS def, a.attnotnull
        FROM pg_constraint c
        LEFT JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
        WHERE c.conrelid::regclass::text IN ('"Prompt"', '"BranchingTree"', '"Trace"') AND c.contype IN ('p', 'f')
      `) as any[];
      for (const t of ['"Prompt"', '"BranchingTree"', '"Trace"']) {
        expect(rows.some((r) => r.tbl === t && r.contype === 'p' && /\(id\)/.test(r.def))).toBe(true);
        expect(rows.some((r) => r.tbl === t && r.contype === 'f' && r.confdeltype === 'c' && r.attnotnull && /"User"\(id\)/.test(r.def))).toBe(true);
      }
    });

    it('every column of the profile GET exists in "User"', async () => {
      const cols = ['id', 'name', 'username', 'email', 'avatar_url', 'avatar_initials', 'plan', 'role', 'bio', 'location',
        'organization', 'github', 'huggingface', 'website', 'joined_date', 'created_at', 'subscription_tier'];
      const rows = (await sql`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User'`) as any[];
      const live = new Set(rows.map((r) => r.column_name));
      expect(cols.filter((c) => !live.has(c))).toEqual([]);
    });

    it('accepts all four Trace.status values the API writes (OK, ERR, success, error)', async () => {
      for (const st of ['OK', 'ERR', 'success', 'error']) {
        await sql`
          INSERT INTO "Trace" (id, user_id, node_origin, model_target, tokens_used, latency_ms, status, created_at)
          VALUES (${tag + '_st_' + st}, ${userA}, 'n', 'm', 1, 1, ${st}, NOW())
        `;
      }
      const [{ n }] = (await sql`SELECT count(*)::int AS n FROM "Trace" WHERE id LIKE ${tag + '_st_%'}`) as any[];
      expect(n).toBe(4);
    });

    it('deleting a user removes their prompts, workflows and traces; logs keep the row without the user id', async () => {
      const u = `${tag}_gone`;
      await makeUser(u);
      await sql`INSERT INTO "Prompt" (id, user_id, title, snippet, full_content, tags, target_type, created_at, updated_at) VALUES (${u + '_p'}, ${u}, 't', 's', 'c', '[]', 'G', NOW(), NOW())`;
      await sql`INSERT INTO "BranchingTree" (id, user_id, title, nodes, edges, created_at, updated_at) VALUES (${u + '_w'}, ${u}, 't', '[]', '[]', NOW(), NOW())`;
      await sql`INSERT INTO "Trace" (id, user_id, node_origin, model_target, tokens_used, latency_ms, status, created_at) VALUES (${u + '_t'}, ${u}, 'n', 'm', 1, 1, 'OK', NOW())`;
      await sql`INSERT INTO "SecurityLog" (id, user_id, event_type, message) VALUES (${tag + '_slu'}, ${u}, 'DBTEST', 'm')`;
      await sql`DELETE FROM "User" WHERE id = ${u}`;
      const [left] = (await sql`
        SELECT (SELECT count(*)::int FROM "Prompt" WHERE user_id = ${u}) AS prompts,
               (SELECT count(*)::int FROM "BranchingTree" WHERE user_id = ${u}) AS workflows,
               (SELECT count(*)::int FROM "Trace" WHERE user_id = ${u}) AS traces,
               (SELECT user_id FROM "SecurityLog" WHERE id = ${tag + '_slu'}) AS log_user
      `) as any[];
      expect(left).toEqual({ prompts: 0, workflows: 0, traces: 0, log_user: null });
    });
  });

  describe('Backend save pattern with the row cap (CHG-0008 / CHG-0013)', () => {
    // api/workflows/index.ts: UPDATE ... WHERE id AND user_id, then INSERT ... SELECT ... WHERE count < cap ON CONFLICT (id) DO NOTHING
    const insertLikeApi = (id: string, user: string) => sql`
      INSERT INTO "BranchingTree" (id, user_id, title, nodes, edges, created_at, updated_at)
      SELECT ${id}, ${user}, 'api', '[]', '[]', NOW(), NOW()
      WHERE (SELECT COUNT(*) FROM "BranchingTree" WHERE user_id = ${user}) < 200
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `;

    it('another user inserting an existing id gets no row and no error', async () => {
      const id = `${tag}_wf1`; // created by the 500-workflow test for userB
      const rows = await insertLikeApi(id, userA);
      expect(rows).toHaveLength(0);
      const [owner] = (await sql`SELECT user_id FROM "BranchingTree" WHERE id = ${id}`) as any[];
      expect(owner.user_id).toBe(userB);
    });

    it('the owner can still update at the cap', async () => {
      const rows = await sql`UPDATE "BranchingTree" SET title = 'api edit', updated_at = NOW() WHERE id = ${tag + '_wf2'} AND user_id = ${userB} RETURNING id`;
      expect(rows).toHaveLength(1);
    });
  });

  describe('SecurityLog limits (0005)', () => {
    it('refuses over-long message, ip, event_type and endpoint', async () => {
      const cases = [
        sql`INSERT INTO "SecurityLog" (id, event_type, message) VALUES (${tag + '_l1'}, 'X', ${'m'.repeat(2001)})`,
        sql`INSERT INTO "SecurityLog" (id, event_type, message, ip_address) VALUES (${tag + '_l2'}, 'X', 'm', ${'1'.repeat(65)})`,
        sql`INSERT INTO "SecurityLog" (id, event_type, message) VALUES (${tag + '_l3'}, ${'E'.repeat(101)}, 'm')`,
        sql`INSERT INTO "SecurityLog" (id, event_type, message, endpoint) VALUES (${tag + '_l4'}, 'X', 'm', ${'/'.repeat(201)})`,
      ];
      for (const c of cases) await expect(c).rejects.toThrow(/SecurityLog_size_chk/);
    });

    it('accepts a normal row', async () => {
      await sql`INSERT INTO "SecurityLog" (id, event_type, message, ip_address, endpoint) VALUES (${tag + '_ok'}, 'AUTH_SIGNATURE_INVALID', 'x', '203.0.113.9', '/api/ai/synthesize')`;
    });
  });

  describe('function rights (0006)', () => {
    it('PUBLIC cannot run reserve_quota() or purge_old_logs(); this connection still can', async () => {
      const [r] = (await sql`
        SELECT has_function_privilege('public', 'reserve_quota(text,text,text,text,text,integer,interval)', 'EXECUTE') AS pub_q,
               has_function_privilege('public', 'purge_old_logs(integer)', 'EXECUTE') AS pub_p,
               has_function_privilege(current_user, 'reserve_quota(text,text,text,text,text,integer,interval)', 'EXECUTE') AS me_q
      `) as any[];
      expect(r).toEqual({ pub_q: false, pub_p: false, me_q: true });
    });
  });

  describe('account guards on "User" (0007, 0009)', () => {
    it('refuses a second account whose email differs only in case', async () => {
      await expect(sql`
        INSERT INTO "User" (id, email, password_hash, name, updated_at)
        VALUES (${tag + '_case'}, ${(userA + '@test.invalid').toUpperCase()}, 'x', 'n', NOW())
      `).rejects.toThrow(/User_email_lower_key/);
    });

    it('refuses a username that differs only in case; empty usernames are allowed for many users', async () => {
      await sql`UPDATE "User" SET username = ${tag + '_Name'} WHERE id = ${userA}`;
      await expect(sql`UPDATE "User" SET username = ${(tag + '_name').toUpperCase()} WHERE id = ${userB}`)
        .rejects.toMatchObject({ code: '23505' }); // the API turns 23505 into 409 PROFILE_VALUE_TAKEN
      await sql`UPDATE "User" SET username = NULL WHERE id IN (${userA}, ${userB})`;
    });
  });

  describe('reserve_quota hardening (0008)', () => {
    it('limits callers with no user and no IP (counted as "unknown")', async () => {
      const bucket = `${tag}_bnull`;
      const got = [];
      for (let i = 0; i < 3; i++) got.push(await reserve(`${tag}_nn${i}`, null, null, 1, bucket));
      expect(got.filter(Boolean)).toHaveLength(1);
    });

    it('gives no free unit when another caller reuses a reservation id', async () => {
      const bucket = `${tag}_breuse`;
      expect(await reserve(`${tag}_ru`, userA, '198.51.100.1', 100, bucket)).toBe(true);
      expect(await reserve(`${tag}_ru`, userB, '198.51.100.2', 100, bucket)).toBe(false);
      expect(await reserve(`${tag}_ri`, null, `${tag}_ip1`, 100, bucket)).toBe(true);
      expect(await reserve(`${tag}_ri`, null, `${tag}_ip2`, 100, bucket)).toBe(false);
    });

    it('stores a 10,000-character IP as at most 64 characters', async () => {
      await reserve(`${tag}_long`, null, 'z'.repeat(10_000), 5, `${tag}_blong`);
      const [r] = (await sql`SELECT char_length(ip_address) AS n FROM "QuotaEvent" WHERE id = ${tag + '_long'}`) as any[];
      expect(r.n).toBeLessThanOrEqual(64);
      await sql`DELETE FROM "QuotaEvent" WHERE id = ${tag + '_long'}`;
    });

    it('answers "no" for a limit of 0 or below', async () => {
      expect(await reserve(`${tag}_z0`, userA, 'x', 0, `${tag}_bzero`)).toBe(false);
      expect(await reserve(`${tag}_zn`, userA, 'x', -1, `${tag}_bzero`)).toBe(false);
    });
  });

  describe('trace_totals (0010)', () => {
    it('adds up ALL of a user\'s traces, not just the last 100', async () => {
      const u = `${tag}_tot`;
      await makeUser(u);
      await sql`
        INSERT INTO "Trace" (id, user_id, node_origin, model_target, tokens_used, latency_ms, status, created_at)
        SELECT ${u} || '_' || g, ${u}, 'n', (ARRAY['m1','m2','m3'])[1 + g % 3], 10, g, (ARRAY['OK','success','ERR'])[1 + g % 3], NOW()
        FROM generate_series(0, 149) g
      `;
      const [t] = (await sql`SELECT * FROM trace_totals(${u})`) as any[];
      expect(t.total_inferences).toBe(150);
      expect(Number(t.total_tokens)).toBe(1500);
      expect(t.avg_latency).toBe(75);
      expect(t.p99_latency).toBe(148); // same index the API uses today: sorted[floor(n * 0.99)]
      expect(Number(t.reliability)).toBe(66.7);
      expect([...t.active_models].sort()).toEqual(['m1', 'm2', 'm3']);
    });

    it('returns one row of zeros (reliability 100) for a user with no traces', async () => {
      const [t] = (await sql`SELECT * FROM trace_totals(${tag + '_nobody'})`) as any[];
      expect(t).toMatchObject({ total_inferences: 0, avg_latency: 0, p99_latency: 0 });
      expect(Number(t.reliability)).toBe(100);
      expect(t.active_models).toEqual([]);
    });
  });
});
