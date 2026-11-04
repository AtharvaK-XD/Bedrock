import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The quota fallback through the REAL Neon driver (nothing mocked but the network). The other quota tests replace the
// driver, so they cannot catch a wrong sql.transaction() call; on a database without migration 0004 such a mistake
// would fail closed and refuse every AI request. Checks the "function is missing" answer -> fallback -> what is sent.

const FAKE_URL = 'postgresql://user:password@ep-test.us-east-2.aws.neon.tech/neondb';
const user = { id: 'user_D', email: 'd@example.com', name: 'D', role: 'r', plan: 'Free Plan', subscriptionTier: 'free', isGuest: false } as any;

type Sent = { headers: Headers; body: any };
let sent: Sent[];
let insertRows: unknown[][];

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
// Neon's wire format: rows are arrays, matched to the field list
const result = (name: string, rows: unknown[][]) => ({ command: 'SELECT', rowCount: rows.length, rows, fields: [{ name, dataTypeID: 25 }], rowAsArray: true });

beforeEach(() => {
  sent = [];
  insertRows = [['row']];
  vi.resetModules();
  vi.stubEnv('DATABASE_URL', FAKE_URL);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn(async (_url: unknown, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    sent.push({ headers: new Headers(init.headers), body });
    // A single query is the reserve_quota() probe: answer like a database without migration 0004
    if (body.query) return json(400, { message: 'function reserve_quota(...) does not exist', code: '42883' });
    return json(200, { results: [result('pg_advisory_xact_lock', [['']]), result('id', insertRows)] });
  }));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('quota fallback through the real Neon driver', () => {
  it('after "function missing", sends the lock and the insert as ONE READ COMMITTED transaction, lock first', async () => {
    const { reserveQuota } = await import('../security.js');
    const q = await reserveQuota({ bucket: 'generation', endpoint: '/api/ai/synthesize', user, ip: '203.0.113.9' });

    if (q.unavailable) throw (console.error as any).mock.calls[0]?.[1] ?? new Error('quota unavailable');
    expect(q).toMatchObject({ allowed: true, unavailable: false, store: 'SecurityLog' });
    expect(q.reservationId).toMatch(/^quota_/);

    expect(sent).toHaveLength(2);
    expect(sent[0].body.query).toContain('reserve_quota(');

    const batch = sent[1];
    expect(batch.body.queries).toHaveLength(2);
    expect(batch.headers.get('Neon-Batch-Isolation-Level')).toBe('ReadCommitted');
    expect(batch.body.queries[0].query).toContain('pg_advisory_xact_lock(hashtextextended($1::text, 0))');
    expect(batch.body.queries[0].params).toEqual(['u:user_D:generation']);
    expect(batch.body.queries[1].query).toContain('INSERT INTO "SecurityLog"');
    expect(batch.body.queries[1].params).toContain('user_D');
  });

  it('reads the answer of the second statement: no row back means the limit is reached', async () => {
    const { reserveQuota } = await import('../security.js');
    insertRows = [];
    const q = await reserveQuota({ bucket: 'generation', endpoint: '/x', user: null, ip: '2001:db8:1:2::/64' });
    expect(q).toMatchObject({ allowed: false, unavailable: false, reservationId: null, store: 'SecurityLog' });
    expect(sent[1].body.queries[0].params).toEqual(['ip:2001:db8:1:2::/64:generation']);
  });
});
