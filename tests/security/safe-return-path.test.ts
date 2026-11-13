// /sso-callback?returnUrl=... is read from the address bar, so anyone can put any value in a link. Only paths on
// this site may be followed after sign-in (src/lib/safeRedirect.ts, used by src/pages/SSOCallback.tsx).
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { safeReturnPath } from '../../src/lib/safeRedirect';

describe('safeReturnPath', () => {
  it('keeps paths on this site, including the one the GitHub linking flow sends', () => {
    expect(safeReturnPath('/app/profile')).toBe('/app/profile');
    expect(safeReturnPath(decodeURIComponent(encodeURIComponent('/app/profile')))).toBe('/app/profile');
    expect(safeReturnPath('/app/branching?shared=abc#top')).toBe('/app/branching?shared=abc#top');
    expect(safeReturnPath('/')).toBe('/');
  });

  it.each([
    'https://evil.example/login',
    'http://evil.example',
    '//evil.example',
    '///evil.example',
    '/\\evil.example',
    '\\\\evil.example',
    'javascript:alert(document.cookie)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'app/profile',
    '/app\tprofile',
    '/app\nprofile',
    ' /app',
    '/' + 'a'.repeat(600),
  ])('refuses %j and falls back to /app', (raw) => {
    expect(safeReturnPath(raw)).toBe('/app');
  });

  it('falls back when there is no value', () => {
    expect(safeReturnPath(null)).toBe('/app');
    expect(safeReturnPath(undefined)).toBe('/app');
    expect(safeReturnPath('')).toBe('/app');
    expect(safeReturnPath('https://evil.example', '/')).toBe('/');
  });

  it('the sign-in callback page never uses returnUrl without it', () => {
    const page = fs.readFileSync(path.resolve(__dirname, '../../src/pages/SSOCallback.tsx'), 'utf-8');
    const reads = page.match(/searchParams\.get\('returnUrl'\)/g) ?? [];
    const guarded = page.match(/safeReturnPath\(searchParams\.get\('returnUrl'\)\)/g) ?? [];
    expect(reads.length).toBeGreaterThan(0);
    expect(guarded.length).toBe(reads.length);
  });
});
