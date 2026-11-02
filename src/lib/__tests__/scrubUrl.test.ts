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
