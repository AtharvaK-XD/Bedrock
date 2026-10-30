// Database tests for migrations 0001-0004 (db/migrations).
// Runs ONLY when DATABASE_URL_DEV points at a Neon DEV branch that already has the migrations applied
// (node db/migrate.mjs up --yes). Without it every test here is skipped. It never reads DATABASE_URL.
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

async function reserve(id: string, user: string | null, ip: string, limit: number, bucket = 'generation') {
  const rows = (await sql`
    SELECT reserve_quota(${id}, ${user}, ${ip}, ${bucket}, '/test', ${limit}) AS ok
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
  });
});
