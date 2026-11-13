import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Every database call has a time limit (api/_lib/db.ts). Runs the REAL Neon driver with only the network replaced, so a
// driver update that stopped passing our options (or stopped spreading them per request) would fail here.

const FAKE_URL = 'postgresql://user:password@ep-test.us-east-2.aws.neon.tech/neondb';

type Sent = { signal: AbortSignal | undefined; body: any };
let sent: Sent[];
let hang: boolean;

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const result = (name: string, rows: unknown[][]) => ({ command: 'SELECT', rowCount: rows.length, rows, fields: [{ name, dataTypeID: 25 }], rowAsArray: true });

beforeEach(() => {
  sent = [];
  hang = false;
  vi.resetModules();
  vi.stubEnv('DATABASE_URL', FAKE_URL);
  vi.stubGlobal('fetch', vi.fn((_url: unknown, init: RequestInit) => {
    const signal = init.signal ?? undefined;
    const body = JSON.parse(String(init.body));
    sent.push({ signal, body });
    if (hang) {
      // A database that never answers: only the request's own signal can end the wait
      return new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    }
    if (body.queries) return Promise.resolve(json(200, { results: body.queries.map(() => result('one', [['1']])) }));
    return Promise.resolve(json(200, result('one', [['1']])));
  }));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('database time limit', () => {
  it('every query and every transaction batch gets its own, fresh time limit', async () => {
    const { getDb } = await import('../db.js');
    const sql = getDb();
    await sql`SELECT 1 AS one`;
    await sql`SELECT 2 AS one`;
    await sql.transaction([sql`SELECT 1 AS one`, sql`SELECT 2 AS one`]);

    expect(sent).toHaveLength(3);
    for (const s of sent) {
      expect(s.signal).toBeInstanceOf(AbortSignal);
      expect(s.signal!.aborted).toBe(false);
    }
    // Not one shared signal: that would run out once for every later query
    expect(new Set(sent.map((s) => s.signal)).size).toBe(3);
  });

  it('a database that never answers is cut off after the limit, as a recognisable timeout', async () => {
    vi.stubEnv('DB_QUERY_TIMEOUT_MS', '150');
    const { getDb } = await import('../db.js');
    const { isDbTimeoutError } = await import('../dataHttp.js');
    hang = true;

    const started = Date.now();
    const err = await getDb()`SELECT 1 AS one`.then(
      () => null,
      (e: unknown) => e
    );
    const waited = Date.now() - started;

    expect(err).toBeTruthy();
    expect(isDbTimeoutError(err)).toBe(true);
    expect(waited).toBeGreaterThanOrEqual(100);
    expect(waited).toBeLessThan(5_000);
  });

  it('DB_QUERY_TIMEOUT_MS: 15 s by default, a sane override is used, nonsense is ignored', async () => {
    const { dbQueryTimeoutMs, DB_QUERY_TIMEOUT_MS } = await import('../db.js');
    expect(DB_QUERY_TIMEOUT_MS).toBe(15_000);
    expect(dbQueryTimeoutMs()).toBe(15_000);
    for (const [value, expected] of [
      ['2000', 2_000],
      ['', 15_000],
      ['   ', 15_000],
      ['abc', 15_000],
      ['50', 15_000], // below 100 ms would cut normal queries
      ['999999', 15_000], // above 55 s would be past Vercel's own limit
      ['-1', 15_000],
    ] as const) {
      vi.stubEnv('DB_QUERY_TIMEOUT_MS', value);
      expect(dbQueryTimeoutMs(), value).toBe(expected);
    }
  });
});

describe('data routes answer a database timeout with 503 + Retry-After', () => {
  function mockRes() {
    const res: any = { statusCode: 200, headers: {} as Record<string, string> };
    res.setHeader = vi.fn((k: string, v: string) => void (res.headers[k] = v));
    res.status = vi.fn((c: number) => ((res.statusCode = c), res));
    res.json = vi.fn((b: unknown) => ((res.body = b), res));
    return res;
  }

  it('timeout (wrapped by the driver, or raw while reading the answer) -> 503 DATABASE_TIMEOUT, no internals', async () => {
    const { sendDbFailure } = await import('../dataHttp.js');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const timeout = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    const wrapped = Object.assign(new Error('Error connecting to database: TimeoutError: secret detail "User"'), { sourceError: timeout });

    for (const err of [wrapped, timeout]) {
      const res = mockRes();
      sendDbFailure(res, '[Test]', 'Failed to load', err);
      expect(res.statusCode).toBe(503);
      expect(res.headers['Retry-After']).toBe('5');
      expect(res.body).toMatchObject({ error: 'Failed to load', code: 'DATABASE_TIMEOUT', retryAfterSeconds: 5 });
      expect(JSON.stringify(res.body)).not.toContain('secret detail');
    }
  });

  it('any other database error keeps its 500 answer', async () => {
    const { sendDbFailure } = await import('../dataHttp.js');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = mockRes();
    sendDbFailure(res, '[Test]', 'Failed to load', Object.assign(new Error('relation "X" does not exist'), { code: '42P01' }));
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to load', message: 'Something went wrong on our side. Please try again.' });
    expect(res.setHeader).not.toHaveBeenCalled();
  });
});
