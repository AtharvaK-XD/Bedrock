import { describe, it, expect } from 'vitest';
import { readServerBusySeconds, serverBusyError } from '../api';

const res = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

describe('readServerBusySeconds', () => {
  it('uses retryAfterSeconds from a 503 body', async () => {
    expect(await readServerBusySeconds(res(503, { retryAfterSeconds: 15 }))).toBe(15);
  });

  it('falls back to the Retry-After header, then to 15 s', async () => {
    expect(await readServerBusySeconds(res(503, {}, { 'Retry-After': '30' }))).toBe(30);
    expect(await readServerBusySeconds(new Response('not json', { status: 503 }))).toBe(15);
  });

  it('caps very long waits at 300 s', async () => {
    expect(await readServerBusySeconds(res(503, { retryAfterSeconds: 99999 }))).toBe(300);
  });

  it('returns null for anything that is not a 503', async () => {
    expect(await readServerBusySeconds(res(500, { retryAfterSeconds: 15 }))).toBeNull();
    expect(await readServerBusySeconds(res(200, {}))).toBeNull();
  });

  it('leaves the original body readable', async () => {
    const r = res(503, { retryAfterSeconds: 15, message: 'busy' });
    await readServerBusySeconds(r);
    expect((await r.json()).message).toBe('busy');
  });
});

describe('serverBusyError', () => {
  it('is not treated as an API key problem by the pages', () => {
    const err = serverBusyError(15) as any;
    expect(err.isApiKeyError).toBe(false);
    expect(err.code).toBe('AI_BUSY');
    expect(err.statusCode).toBe(503);
    // Wizard/Result treat any message containing "api key" as a key error, so it must not appear
    expect(err.message.toLowerCase()).not.toContain('api key');
    expect(err.message).toContain('15 seconds');
  });
});
