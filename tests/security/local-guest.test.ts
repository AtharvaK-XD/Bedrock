// The anonymous "local architect" account is for development on this computer only (api/_lib/auth.ts).
// No token is sent in these tests; the database is mocked.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/_lib/db.js', () => ({
  getDb: () => () => Promise.resolve([]),
  logSecurityEvent: async () => {},
}));

import { authenticateRequest } from '../../api/_lib/auth.ts';

const req = (headers: Record<string, string>) => ({ headers }) as any;
const original = process.env.VERCEL_ENV;

beforeEach(() => {
  delete process.env.VERCEL_ENV;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  if (original === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = original;
});

describe('local development guest', () => {
  it('exists for a local host when not running on Vercel', async () => {
    for (const host of ['localhost', 'localhost:3000', '127.0.0.1:5173', '[::1]:3000', 'LOCALHOST:3000', 'tauri.localhost']) {
      const user = await authenticateRequest(req({ host }));
      expect(user, host).toMatchObject({ isGuest: true, id: 'usr_lead_architect_01' });
    }
  });

  it('exists with "vercel dev" (VERCEL_ENV=development)', async () => {
    process.env.VERCEL_ENV = 'development';
    expect(await authenticateRequest(req({ host: 'localhost:3000' }))).toMatchObject({ isGuest: true });
  });

  it('never exists on Vercel production or preview, whatever the Host header says', async () => {
    for (const env of ['production', 'preview']) {
      process.env.VERCEL_ENV = env;
      expect(await authenticateRequest(req({ host: 'localhost:3000' })), env).toBeNull();
      expect(await authenticateRequest(req({ host: '127.0.0.1' })), env).toBeNull();
    }
  });

  it('is not created by look-alike hosts or by the Origin header', async () => {
    for (const host of ['localhost.evil.example', 'evil.example/localhost', '127.0.0.1.evil.example', 'mylocalhost', 'tauri.evil.example', 'evil.example?x=localhost:3000']) {
      expect(await authenticateRequest(req({ host })), host).toBeNull();
    }
    expect(await authenticateRequest(req({ host: 'bedrock-steel.vercel.app', origin: 'http://localhost:3000' }))).toBeNull();
    expect(await authenticateRequest(req({ origin: 'http://localhost:3000' }))).toBeNull();
    expect(await authenticateRequest(req({}))).toBeNull();
  });
});
