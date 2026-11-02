// In-memory Postgres (PGlite) tests for list paging (db/PAGING.md + migration 0017). The tests run the EXACT SQL blocks
// written in PAGING.md, so the document Backend copies from is the document that is tested.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadPglite, migrateUp, readDbFile, rows, seedUsers } from './helper';

const PGlite = await loadPglite();

function sqlBlocks(): Record<string, string> {
  const out: Record<string, string> = {};
  const doc = readDbFile('PAGING.md').replace(/\r\n/g, '\n');
  for (const m of doc.matchAll(/`sql\n-- name: (\w+)\n([\s\S]*?)`/g)) out[m[1]] = m[2].trim();
  return out;
}

describe.skipIf(!PGlite)('list paging', () => {
  const Q = sqlBlocks();
  let db: any;

  beforeAll(async () => {
    db = new PGlite();
    await migrateUp(db, new Set<string>());
    await seedUsers(db);
    await db.query(`INSERT INTO "User"(id,email,password_hash,name,updated_at) VALUES ('uc','c@x.test','x','c',now())`);
    // ua: 1,500 prompts, 500 of them with the SAME updated_at (the hard case for paging); ub, uc: other people's rows
    await db.query(`INSERT INTO "Prompt"(id,user_id,title,snippet,full_content,tags,target_type,created_at,updated_at)
      SELECT 'a'||lpad(g::text,5,'0'),'ua','t'||g,'s',repeat('x',2000),'[]','G',
             now() - (g||' minutes')::interval,
             CASE WHEN g <= 500 THEN timestamp '2026-01-01 10:00:00' ELSE now() - (g||' minutes')::interval END
      FROM generate_series(1,1500) g`);
    await db.query(`INSERT INTO "Prompt"(id,user_id,title,snippet,full_content,tags,target_type,created_at,updated_at)
      SELECT 'b'||g,'ub','t','s','c','[]','G',now(),now() - (g||' seconds')::interval FROM generate_series(1,800) g`);
    await db.query(`INSERT INTO "Prompt"(id,user_id,title,snippet,full_content,tags,target_type,created_at,updated_at)
      SELECT 'c'||g,'uc','t','s','c','[]','G',now(),now() - (g||' seconds')::interval FROM generate_series(1,800) g`);
    await db.query(`INSERT INTO "BranchingTree"(id,user_id,title,nodes,edges,created_at,updated_at)
      SELECT 'w'||lpad(g::text,4,'0'),'ua','wf'||g,repeat('n',1000),repeat('e',500),now(),
             CASE WHEN g <= 120 THEN timestamp '2026-01-01 10:00:00' ELSE now() - (g||' minutes')::interval END
      FROM generate_series(1,400) g`);
    await db.query(`ANALYZE "Prompt"`);
    await db.query(`ANALYZE "BranchingTree"`);
  }, 180_000);

  afterAll(async () => {
    await db?.close();
  });

  it('the document contains all six queries', () => {
    expect(Object.keys(Q).sort()).toEqual(['prompt_one', 'prompts_first_page', 'prompts_next_page', 'workflow_one', 'workflows_first_page', 'workflows_next_page']);
  });

  async function walk(first: string, next: string, pageSize: number) {
    const seen: string[] = [];
    let page = await rows(db, Q[first], ['ua', pageSize + 1]);
    let pages = 0;
    for (;;) {
      pages++;
      const send = page.slice(0, pageSize);
      seen.push(...send.map((r: any) => r.id));
      if (page.length <= pageSize) break;
      const last = send[send.length - 1];
      expect(last.cursor_ts).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{6}$/);
      page = await rows(db, Q[next], ['ua', last.cursor_ts, last.id, pageSize + 1]);
      if (pages > 200) throw new Error('paging did not end');
    }
    return { seen, pages };
  }

  it('prompts: walking all pages returns every row exactly once, newest first, even with 500 identical timestamps', async () => {
    const { seen, pages } = await walk('prompts_first_page', 'prompts_next_page', 50);
    expect(pages).toBe(30);
    expect(seen).toHaveLength(1500);
    expect(new Set(seen).size).toBe(1500);
    const all = (await rows(db, `SELECT id FROM "Prompt" WHERE user_id = 'ua' ORDER BY updated_at DESC, id DESC`)).map((r: any) => r.id);
    expect(seen).toEqual(all);
  });

  it('workflows: same guarantee, and the list carries no nodes/edges', async () => {
    const { seen } = await walk('workflows_first_page', 'workflows_next_page', 25);
    expect(seen).toHaveLength(400);
    expect(new Set(seen).size).toBe(400);
    const [r] = await rows(db, Q.workflows_first_page, ['ua', 1]);
    expect(Object.keys(r).sort()).toEqual(['created_at', 'cursor_ts', 'id', 'size_chars', 'title', 'updated_at']);
    expect(Number(r.size_chars)).toBe(1500);
  });

  it('the prompt list carries no full text; the single-item query returns it and never another user\'s item', async () => {
    const [r] = await rows(db, Q.prompts_first_page, ['ua', 1]);
    expect(Object.keys(r)).not.toContain('full_content');
    const one = await rows(db, Q.prompt_one, ['a00001', 'ua']);
    expect(one[0].full_content).toHaveLength(2000);
    expect(await rows(db, Q.prompt_one, ['a00001', 'ub'])).toHaveLength(0);
    expect(await rows(db, Q.workflow_one, ['w0001', 'ub'])).toHaveLength(0);
  });

  it('a new or edited item shows up at the top and nothing already read is repeated', async () => {
    const first = await rows(db, Q.prompts_first_page, ['ua', 11]);
    const cursor = first[9];
    await db.query(`UPDATE "Prompt" SET updated_at = now() WHERE id = 'a00900' AND user_id = 'ua'`); // edit moves it to the top
    const next = await rows(db, Q.prompts_next_page, ['ua', cursor.cursor_ts, cursor.id, 50]);
    expect(next.map((r: any) => r.id)).not.toContain('a00900');
    expect((await rows(db, Q.prompts_first_page, ['ua', 1]))[0].id).toBe('a00900');
  });

  it('every page reads the new index in order, with no sort step', async () => {
    const [last] = await rows(db, Q.prompts_first_page, ['ua', 1]);
    for (const [name, params] of [
      ['prompts_first_page', ['ua', 51]],
      ['prompts_next_page', ['ua', last.cursor_ts, last.id, 51]],
      ['workflows_first_page', ['ua', 51]],
      ['workflows_next_page', ['ua', '2026-06-01 00:00:00.000000', 'w0200', 51]],
    ] as const) {
      await db.query('SET enable_seqscan = off'); // tiny test tables: make the planner show the index it WOULD use at scale
      const plan = (await rows(db, `EXPLAIN (COSTS OFF) ${Q[name]}`, [...params])).map((r: any) => r['QUERY PLAN']).join('\n');
      await db.query('RESET enable_seqscan');
      expect(plan, name).toMatch(/Index (Only )?Scan using "?(Prompt|BranchingTree)_user_updated_id_idx"?/);
      expect(plan, name).not.toMatch(/\bSort\b/);
    }
  });

  it('without forcing the planner, the first prompt page also uses the index and no sort', async () => {
    const plan = (await rows(db, `EXPLAIN (COSTS OFF) ${Q.prompts_first_page}`, ['ua', 51])).map((r: any) => r['QUERY PLAN']).join('\n');
    expect(plan).toMatch(/Prompt_user_updated_id_idx/);
    expect(plan).not.toMatch(/\bSort\b/);
  });
});
