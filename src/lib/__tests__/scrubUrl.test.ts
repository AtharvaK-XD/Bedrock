import { describe, expect, it } from 'vitest';
import { REDACTED, scrubDeep, scrubSensitiveUrl } from '../scrubUrl';
import consentSource from '../analyticsConsent.ts?raw';

describe('Sentry setup', () => {
  it('scrubs breadcrumbs, errors, performance traces and session recordings', () => {
    for (const hook of ['beforeBreadcrumb', 'beforeSendTransaction', 'beforeAddRecordingEvent']) {
      expect(consentSource, hook).toMatch(new RegExp(`${hook}: \\(\\w+\\) => scrubDeep\\(`));
    }
    expect(consentSource).toMatch(/return scrubDeep\(event\)/);
  });
});

describe('scrubSensitiveUrl', () => {
  it('hides API keys and tokens in query strings', () => {
    expect(scrubSensitiveUrl('https://generativelanguage.googleapis.com/v1beta/models/x:generateContent?key=AIzaSyFAKEFAKE'))
      .toBe(`https://generativelanguage.googleapis.com/v1beta/models/x:generateContent?key=${REDACTED}`);
    expect(scrubSensitiveUrl('https://x.example/a?alt=sse&key=AIzaSyFAKE&pageSize=1'))
      .toBe(`https://x.example/a?alt=sse&key=${REDACTED}&pageSize=1`);
    expect(scrubSensitiveUrl('https://x.example/?access_token=abc&API_KEY=def&apiKey=ghi'))
      .toBe(`https://x.example/?access_token=${REDACTED}&API_KEY=${REDACTED}&apiKey=${REDACTED}`);
  });

  it('hides sign-in codes, tickets and the desktop sign-in payload', () => {
    expect(scrubSensitiveUrl('https://site/sso-callback?code=4/0Afake&state=xyz')).toBe(`https://site/sso-callback?code=${REDACTED}&state=xyz`);
    expect(scrubSensitiveUrl('bedrock://auth-complete?data=%7B%22token%22%3A%22eyJ...%22%7D')).toBe(`bedrock://auth-complete?data=${REDACTED}`);
    expect(scrubSensitiveUrl('http://127.0.0.1:5173/#/browser-auth-callback?nonce=abc123&port=5173')).toBe(`http://127.0.0.1:5173/#/browser-auth-callback?nonce=${REDACTED}&port=5173`);
    expect(scrubSensitiveUrl('https://site/?ticket=sit_abc')).toBe(`https://site/?ticket=${REDACTED}`);
  });

  it('works inside span names and leaves ordinary text alone', () => {
    expect(scrubSensitiveUrl('POST https://api.example/v1?key=SECRET123 200')).toBe(`POST https://api.example/v1?key=${REDACTED} 200`);
    expect(scrubSensitiveUrl('https://bedrock-steel.vercel.app/api/prompts?limit=50&summary=1')).toBe('https://bedrock-steel.vercel.app/api/prompts?limit=50&summary=1');
    expect(scrubSensitiveUrl('a = b and key is blue')).toBe('a = b and key is blue');
    expect(scrubSensitiveUrl('https://site/?keyboard=1&monkey=2')).toBe('https://site/?keyboard=1&monkey=2');
  });
});

describe('PostHog setup', () => {
  it('records clicks without element text or attributes, and scrubs every event', async () => {
    const mainSource = (await import('../../main.tsx?raw')).default as string;
    expect(mainSource).toMatch(/mask_all_text: true/);
    expect(mainSource).toMatch(/mask_all_element_attributes: true/);
    expect(mainSource).toMatch(/before_send: \(\w+[^)]*\) => scrubDeep\(/);
  });
});

describe('secret-shaped values anywhere in a text (scrubText)', () => {
  it('hides every key shape Bedrock users hold, plus tokens and database passwords', async () => {
    const { scrubText } = await import('../scrubUrl');
    // Fake keys, joined at runtime so no key-shaped text sits in this file (scanners would flag it)
    const secrets = [
      ['sk-proj-', 'AbCdEf1234567890_GhIjKlMnOpQrStUv'], ['sk-ant-api03-', 'AbCdEf1234567890-GhIjKlMnOp'], ['sk-or-v1-', '0123456789abcdef0123456789abcdef'],
      ['sk-', 'AbCdEfGhIjKlMnOpQrStUvWx'], ['sk_live_', 'AbCdEfGhIjKlMnOpQr12'], ['AIza', 'SyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q'], ['gsk_', 'AbCdEfGhIjKlMnOpQrStUvWx12'],
      ['xai-', 'AbCdEfGhIjKlMnOpQrStUvWx'], ['hf_', 'AbCdEfGhIjKlMnOpQrStUvWx12'], ['whsec_', 'AbCdEfGhIjKlMnOpQr12'],
      ['eyJhbGciOiJSUzI1NiJ9.', 'eyJzdWIiOiJ1c2VyX2EifQ.c2lnbmF0dXJlLXZhbHVl'],
    ].map((parts) => parts.join(''));
    for (const s of secrets) {
      const out = scrubText(`request failed for key ${s} at 12:00`);
      expect(out, s).not.toContain(s);
      expect(out).toContain('request failed for key');
    }
    expect(scrubText('Authorization: Bearer abcdefghijklmnopqrstuvwxyz0123')).toBe(`Authorization: Bearer ${REDACTED}`);
    const dbUrl = ['postgresql://neondb_owner:', 'npg_FakePassword123@ep-x.neon.tech/db'].join('');
    expect(scrubText(dbUrl)).toBe(`postgresql://neondb_owner:${REDACTED}@ep-x.neon.tech/db`);
  });

  it('leaves ordinary words alone', async () => {
    const { scrubText } = await import('../scrubUrl');
    for (const t of ['a task-oriented skill-based approach', 'risk-free desk-sharing', 'Ask about pk_live keys']) expect(scrubText(t)).toBe(t);
  });
});

describe('scrubDeep', () => {
  it('scrubs every string in a Sentry-shaped event, breadcrumb and replay record', () => {
    const event: any = {
      request: { url: 'https://g.example/m?key=AIzaFAKE' },
      breadcrumbs: [{ category: 'fetch', data: { url: 'https://g.example/m?key=AIzaFAKE2', method: 'POST' } }],
      spans: [{ description: 'GET https://g.example/models?pageSize=1&key=AIzaFAKE3' }],
      replay: { data: { payload: { description: 'https://g.example/x?token=t0k' } } },
      count: 3,
    };
    scrubDeep(event);
    expect(JSON.stringify(event)).not.toMatch(/AIzaFAKE|t0k/);
    expect(event.breadcrumbs[0].data.method).toBe('POST');
    expect(event.count).toBe(3);
  });
});
