import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CORE_VERIFIED_FACTS, getGroundedFacts, extractEntitiesFromText } from '../ragGrounding.js';

// The "verified facts" and prompts tell models which tool versions are current. When they go stale,
// Bedrock steers users' prompts to old stacks (this happened: Next.js 15, Zod 3, Vitest 3 after the
// current versions were already 16, 4 and 5). These tests make staleness visible.

const MAX_AGE_DAYS = 180;
const DAY_MS = 24 * 60 * 60 * 1000;
const LIB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('grounded facts table', () => {
  const entries = Object.entries(CORE_VERIFIED_FACTS);

  it('every entry has facts, a domain, a check date and the basis it was checked against', () => {
    expect(entries.length).toBeGreaterThan(10);
    for (const [key, entry] of entries) {
      expect(['coding', 'visual', 'video', 'general'], key).toContain(entry.domain);
      expect(entry.facts.length, key).toBeGreaterThan(0);
      expect(entry.facts.every((f) => typeof f === 'string' && f.trim().length > 10), key).toBe(true);
      expect(entry.verified, key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(entry.verified)), `${key}: ${entry.verified} is not a date`).toBe(false);
      expect(entry.basis.trim().length, `${key} needs a basis`).toBeGreaterThan(10);
    }
  });

  it(`no fact is older than ${MAX_AGE_DAYS} days: if this fails, re-check the entries listed and update their dates`, () => {
    const now = Date.now();
    const old = entries
      .filter(([, e]) => !e.unverified)
      .filter(([, e]) => now - Date.parse(e.verified) > MAX_AGE_DAYS * DAY_MS)
      .map(([key, e]) => `${key} (checked ${e.verified})`);
    expect(
      old,
      `Re-check these against the npm registry / endoflife.date / the vendor docs (see the comment above VerifiedFactEntry in api/_lib/ragGrounding.ts), then set "verified" to today: ${old.join(', ')}`
    ).toEqual([]);
  });

  it('no entry is dated in the future', () => {
    const tomorrow = Date.now() + DAY_MS;
    expect(entries.filter(([, e]) => Date.parse(e.verified) > tomorrow).map(([k]) => k)).toEqual([]);
  });

  it('facts that could not be confirmed are marked, and stay few', () => {
    const unverified = entries.filter(([, e]) => e.unverified).map(([k]) => k);
    // Listed here on purpose: adding one is a decision somebody should notice in review
    expect(unverified).toEqual(['sora']);
  });

  it('the same facts reach the model for each spelling of Next.js', () => {
    expect(CORE_VERIFIED_FACTS.nextjs.facts).toEqual(CORE_VERIFIED_FACTS['next.js'].facts);
    expect(getGroundedFacts('a nextjs dashboard').groundedFactsBlock).toContain('Next.js 16');
    expect(extractEntitiesFromText('built with Next.js and zod')).toEqual(expect.arrayContaining(['next.js', 'zod']));
  });

  it('domain separation still holds: coding facts never reach image prompts, and image facts never reach code prompts', () => {
    expect(getGroundedFacts('a React app with midjourney art', 'image-prompt').groundedFactsBlock).not.toContain('React 19');
    expect(getGroundedFacts('a React app with midjourney art', 'coding-agent').groundedFactsBlock).not.toContain('Midjourney');
  });
});

describe('old version claims must not come back into the prompts', () => {
  // Each pattern was true once and is not now (checked 2026-11-02); the text says what to write instead
  const BANNED: Array<[RegExp, string]> = [
    [/Next\.js 15/, 'Next.js 16 is current'],
    [/Zod 3/, 'Zod 4 is current'],
    [/Vitest [34]\b/, 'Vitest 5 is current'],
    [/Playwright 1\.48/, 'Playwright 1.6x is current'],
    [/Prisma 6/, 'Prisma 7 is the stable line'],
    [/PostgreSQL 16\+/, 'PostgreSQL 17+ (18 is current)'],
    [/v6\.1|--v 6/, 'Midjourney prompts are version-free: no --v unless the user names one'],
    [/Gen-3/, 'Runway is on Gen-4.5; do not name old generations'],
    [/Pika 2\.0/, 'name video engines without versions'],
    [/FLUX\.1 \[dev\/pro\]/, 'say FLUX, not one old release'],
    [/relationMode/, 'relationMode is for databases without foreign keys, not serverless Postgres'],
    [/port 5432 or 6543/, '6543 is Supabase, not Neon'],
  ];

  const sources = readdirSync(LIB_DIR)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => [f, readFileSync(path.join(LIB_DIR, f), 'utf8')] as const);

  it.each(BANNED)('%s is not stated anywhere in api/_lib (%s)', (pattern) => {
    const hits = sources.filter(([, text]) => pattern.test(text)).map(([file]) => file);
    expect(hits).toEqual([]);
  });

  it('the files that were checked are really the prompt files', () => {
    const names = sources.map(([f]) => f);
    expect(names).toEqual(expect.arrayContaining(['ragGrounding.ts', 'masterRolePrompts.ts', 'aiPrompts.ts', 'useCaseProfiles.ts', 'validation.ts']));
  });
});
