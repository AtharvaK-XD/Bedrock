// The website's security headers (vercel.json) and the desktop app's policy (dist-electron/main.js): rules that must
// stay true whatever else changes. Reads the files only; no network.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../..');
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), 'utf8');

const vercel = JSON.parse(read('vercel.json'));
const mainBlock = vercel.headers.find((b: any) => b.source === '/((?!sandbox/).*)');
const header = (name: string) => mainBlock.headers.find((h: any) => h.key === name)?.value as string | undefined;
// Report-only today (OPEN-0023); the same rules must hold once it is enforced
const webCsp = (header('Content-Security-Policy') || header('Content-Security-Policy-Report-Only')) as string;
const directive = (csp: string, name: string) => csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${name} `)) || '';

const mainJs = read('dist-electron/main.js');
const desktopHashes = mainJs.match(/INDEX_INLINE_SCRIPT_HASHES = "([^"]+)"/)?.[1] || '';

function inlineScriptHashes() {
  const html = read('index.html');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  expect(script, 'index.html inline script').toBeTruthy();
  const hash = (s: string) => `sha256-${crypto.createHash('sha256').update(s).digest('base64')}`;
  const lf = script!.replace(/\r\n/g, '\n');
  return [hash(lf), hash(lf.replace(/\n/g, '\r\n'))]; // Linux build (Vercel) and Windows build (installer)
}

describe('website security headers', () => {
  it('sends the protective headers', () => {
    expect(header('Strict-Transport-Security')).toMatch(/max-age=\d{8,}; includeSubDomains/);
    expect(header('X-Frame-Options')).toBe('DENY');
    expect(header('X-Content-Type-Options')).toBe('nosniff');
    expect(header('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(header('Permissions-Policy')).toMatch(/camera=\(\).*microphone=\(\).*geolocation=\(\)/);
  });

  it('never lets a page run injected scripts, or be framed', () => {
    const script = directive(webCsp, 'script-src');
    expect(script).not.toMatch(/'unsafe-inline'|'unsafe-eval'/);
    expect(script.split(' ')).not.toContain('https:');
    expect(script.split(' ')).not.toContain('*');
    expect(webCsp).toContain("object-src 'none'");
    expect(webCsp).toContain("base-uri 'self'");
    expect(webCsp).toContain("frame-ancestors 'none'");
  });

  it('lets the one inline script in index.html run on both the Linux and the Windows build', () => {
    for (const h of inlineScriptHashes()) {
      expect(directive(webCsp, 'script-src'), `web ${h}`).toContain(`'${h}'`);
      expect(desktopHashes, `desktop ${h}`).toContain(`'${h}'`);
    }
  });

  it('allows the services the app really talks to', () => {
    const connect = directive(webCsp, 'connect-src');
    for (const host of [
      'https://bedrock-steel.vercel.app', 'https://*.clerk.accounts.dev', 'https://*.clerk.com', 'https://*.ingest.us.sentry.io',
      'https://us.i.posthog.com', 'https://generativelanguage.googleapis.com', 'https://api.groq.com', 'https://api.openai.com',
      'https://openrouter.ai', 'https://api-inference.huggingface.co', 'https://api.perplexity.ai', 'https://api.github.com', 'http://localhost:*',
    ]) {
      expect(connect, host).toContain(host);
    }
  });
});

describe('trust lists', () => {
  // Nobody owns this name (registry: no record, DNS: does not exist; checked 2026-11-05). Anyone could buy it, so it
  // must not be trusted anywhere until Atharva has registered it and this test is changed on purpose.
  it('do not name the unregistered bedrockxai.com', () => {
    for (const file of ['vercel.json', 'dist-electron/main.js', 'src/lib/sentryTargets.ts', 'api/_lib/auth.ts', 'api/auth/send-email.ts']) {
      expect(read(file).toLowerCase(), file).not.toMatch(/bedrockxai(\\)?\.com/);
    }
  });

  it('never allow a whole-internet script source on the desktop app either', () => {
    const script = mainJs.match(/`script-src 'self' [^`]*`/)?.[0] || '';
    expect(script).toBeTruthy();
    expect(script).not.toMatch(/'unsafe-inline'|'unsafe-eval'| https: /);
  });
});
