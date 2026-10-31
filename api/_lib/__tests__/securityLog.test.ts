import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// logSecurityEvent with the Neon driver mocked: the real db.ts code runs, no real query is sent.
const h = vi.hoisted(() => {
  const state = { calls: [] as Array<{ text: string; values: unknown[] }>, fail: null as Error | null };
  const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
    state.calls.push({ text: strings.join('$').replace(/\s+/g, ' ').trim(), values });
    return state.fail ? Promise.reject(state.fail) : Promise.resolve([]);
  };
  return { state, sql };
});

vi.mock('@neondatabase/serverless', () => ({ neon: () => h.sql }));

import { logSecurityEvent, SECURITY_LOG_LIMITS } from '../db.js';

beforeEach(() => {
  h.state.calls = [];
  h.state.fail = null;
  vi.stubEnv('DATABASE_URL', 'postgres://unit-test-not-a-real-db');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

// Column order of the INSERT: id, user_id, event_type, severity, ip_address, endpoint, message
const inserted = () => {
  const [, userId, eventType, severity, ip, endpoint, message] = h.state.calls[0].values as any[];
  return { userId, eventType, severity, ip, endpoint, message };
};

describe('logSecurityEvent', () => {
  it('matches the SecurityLog size limits of migration 0005', () => {
    expect(SECURITY_LOG_LIMITS).toEqual({ message: 2000, ipAddress: 64, eventType: 100, endpoint: 200 });
  });

  it('cuts over-long values to the database limits, so the row is stored instead of refused', async () => {
    await logSecurityEvent({
      userId: 'user_A',
      eventType: 'E'.repeat(150),
      severity: 'WARN',
      ipAddress: '1'.repeat(300),
      endpoint: '/x'.repeat(200),
      message: 'm'.repeat(10_000),
    });

    expect(h.state.calls).toHaveLength(1);
    expect(h.state.calls[0].text).toContain('INSERT INTO "SecurityLog"');
    const row = inserted();
    expect(row.eventType).toHaveLength(100);
    expect(row.ip).toHaveLength(64);
    expect(row.endpoint).toHaveLength(200);
    expect(row.message).toHaveLength(2000);
    expect(row).toMatchObject({ userId: 'user_A', severity: 'WARN' });
  });

  it('leaves normal values unchanged and stores missing optional values as NULL', async () => {
    await logSecurityEvent({ eventType: 'AUTH_SIGNATURE_INVALID', message: 'short message' });
    expect(inserted()).toEqual({
      userId: null,
      eventType: 'AUTH_SIGNATURE_INVALID',
      severity: 'INFO',
      ip: null,
      endpoint: null,
      message: 'short message',
    });
  });

  it('never throws to the caller when the insert fails', async () => {
    h.state.fail = new Error('connection refused');
    await expect(logSecurityEvent({ eventType: 'X', message: 'y' })).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });
});
