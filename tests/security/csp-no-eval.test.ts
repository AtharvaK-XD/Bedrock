import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// The website's Content-Security-Policy has no 'unsafe-eval'. Nothing Bedrock itself ships may need it,
// and third-party payment code must not run on every page.
const ROOT = path.resolve(__dirname, '../..');

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('no string-to-code on the website', () => {
  it("validating clarifying questions never builds code at runtime (zod's eval probe stays off)", async () => {
    vi.resetModules();
    const RealFunction = globalThis.Function;
    const built: unknown[][] = [];
    const Spy = new Proxy(RealFunction, {
      apply(target, thisArg, args) {
        built.push(args);
        return Reflect.apply(target, thisArg, args);
      },
      construct(target, args) {
        built.push(args);
        return Reflect.construct(target, args);
      },
    });
    vi.stubGlobal('Function', Spy);
    const { ClarifyingQuestionsArraySchema } = await import('../../src/lib/validation');
    const sample = [{ id: 'q1', questionText: 'Which audience?', questionType: 'single_select', options: ['A', 'B'] }];
    ClarifyingQuestionsArraySchema.safeParse(sample);
    ClarifyingQuestionsArraySchema.safeParse(sample);
    expect(built).toEqual([]);
  });

  it('index.html does not load the Razorpay script on every page (it is loaded at checkout only)', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    expect(html).not.toMatch(/<script[^>]+razorpay/i);
  });

  it('the website CSP allows the Razorpay hosts checkout needs, and still no eval', () => {
    const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
    const csp: string = vercel.headers[0].headers.find((h: any) => /content-security-policy/i.test(h.key)).value;
    const dir = (name: string) => (csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(name + ' ')) || '').split(/\s+/);
    expect(dir('script-src')).toEqual(expect.arrayContaining(['https://checkout.razorpay.com', 'https://cdn.razorpay.com']));
    expect(dir('frame-src')).toEqual(expect.arrayContaining(['https://api.razorpay.com', 'https://checkout.razorpay.com']));
    expect(dir('connect-src')).toEqual(expect.arrayContaining(['https://api.razorpay.com', 'https://lumberjack.razorpay.com']));
    expect(dir('script-src')).not.toContain("'unsafe-eval'");
    expect(dir('script-src')).not.toContain("'unsafe-inline'");
    expect(dir('object-src')).toContain("'none'");
    expect(dir('frame-ancestors')).toContain("'none'");
  });
});
