// The website CSP is ENFORCED (OPEN-0089) and violations are reported to /api/csp-report, which logs a minimal,
// token-free summary (api/health.ts handleCspReport). Rate limiter and database are faked.
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/_lib/rateLimiter.js', () => ({ enforceRateLimit: async () => true, getRedisClient: () => null }));
vi.mock('../../api/_lib/db.js', () => ({ getDb: () => { throw new Error('no database in this test'); } }));

import health from '../../api/health.ts';

const vercel = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../vercel.json'), 'utf8'));
const block = (source: string) => vercel.headers.find((h: any) => h.source === source).headers as Array<{ key: string; value: string }>;
const directives = (policy: string) =>
  Object.fromEntries(policy.split(';').map((d) => d.trim()).filter(Boolean).map((d) => { const [k, ...v] = d.split(/\s+/); return [k, v]; }));

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

async function post(body: unknown, query: Record<string, string> = { action: 'csp-report' }, method = 'POST') {
  const r: any = { statusCode: 200, headers: {} };
  r.status = (c: number) => ((r.statusCode = c), r);
  r.json = (b: unknown) => ((r.body = b), r);
  r.end = () => r;
  r.setHeader = (k: string, v: string) => void (r.headers[k] = v);
  await health({ method, query, headers: {}, body } as any, r);
  return r;
}
const logged = () => warn.mock.calls.map((c) => String(c[0])).filter((l) => l.startsWith('[CSP] ')).map((l) => JSON.parse(l.slice(6)));

describe('website CSP is enforced', () => {
  it('both policies are enforced (not report-only) and report to /api/csp-report', () => {
    for (const source of ['/((?!sandbox/).*)', '/sandbox/(.*)']) {
      const headers = block(source);
      expect(headers.find((h) => h.key === 'Content-Security-Policy-Report-Only')).toBeUndefined();
      const csp = headers.find((h) => h.key === 'Content-Security-Policy')!.value;
      expect(directives(csp)['report-uri']).toEqual(['/api/csp-report']);
      expect(directives(csp)['report-to']).toEqual(['csp']);
      expect(headers.find((h) => h.key === 'Reporting-Endpoints')!.value).toBe('csp="/api/csp-report"');
    }
    expect(vercel.rewrites).toContainEqual({ source: '/api/csp-report', destination: '/api/health?action=csp-report' });
    const site = directives(block('/((?!sandbox/).*)').find((h) => h.key === 'Content-Security-Policy')!.value);
    expect(site['script-src']).not.toContain("'unsafe-eval'");
    expect(site['script-src']).not.toContain("'unsafe-inline'");
    // The code-node sandbox may eval (that is its job) but can reach nothing: no network, no other origin
    const sandbox = directives(block('/sandbox/(.*)').find((h) => h.key === 'Content-Security-Policy')!.value);
    expect(sandbox['default-src']).toEqual(["'none'"]);
    expect(sandbox['connect-src']).toBeUndefined();
  });
});

describe('/api/csp-report', () => {
  it('logs a legacy report-uri report with no query string or fragment (they can hold sign-in tokens)', async () => {
    const r = await post({
      'csp-report': {
        'document-uri': 'https://bedrockxai.com/sso-callback?__clerk_handshake=SECRET_TOKEN#frag',
        'violated-directive': 'script-src-elem',
        'effective-directive': 'script-src-elem',
        'blocked-uri': 'https://evil.example/x.js?k=SECRET_TOKEN',
        'source-file': 'https://bedrockxai.com/assets/index.js?v=1',
        'line-number': 12,
      },
    });
    expect(r.statusCode).toBe(204);
    expect(logged()).toEqual([{ directive: 'script-src-elem', blocked: 'https://evil.example/x.js', page: '/sso-callback', source: 'https://bedrockxai.com/assets/index.js', line: 12 }]);
    expect(JSON.stringify(warn.mock.calls)).not.toContain('SECRET_TOKEN');
  });

  it('accepts Reporting API batches (report-to), raw text bodies, and caps how much one request can log', async () => {
    const one = { type: 'csp-violation', body: { documentURL: 'https://bedrockxai.com/app?x=1', effectiveDirective: 'connect-src', blockedURL: 'https://api.example.com/v1', disposition: 'enforce' } };
    await post(JSON.stringify([one, { type: 'deprecation', body: {} }, ...Array(20).fill(one)]));
    const lines = logged();
    expect(lines).toHaveLength(5);
    expect(lines[0]).toMatchObject({ directive: 'connect-src', blocked: 'https://api.example.com/v1', page: '/app', mode: 'enforce' });
  });

  it('ignores junk, oversized bodies and other methods without logging or failing', async () => {
    expect((await post('not json')).statusCode).toBe(204);
    expect((await post('x'.repeat(20_000))).statusCode).toBe(204);
    expect((await post(Buffer.from('{"csp-report":')) ).statusCode).toBe(204);
    expect((await post({}, { action: 'csp-report' }, 'GET')).statusCode).toBe(405);
    expect(logged()).toHaveLength(0);
  });
});
