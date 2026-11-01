import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Deployment guards for vercel.json and the api/ folder. Both broke a deploy or a job once:
// a 13th function file (CHG-0017) and the daily log cleanup cron being removed (576ba74).

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const API_DIR = path.join(ROOT, 'api');
const vercel = JSON.parse(readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));

/** Files Vercel turns into functions: every .ts/.js under api/ except names (files or folders) starting with "_". */
function functionFiles(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith('_') || name.startsWith('.')) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) found.push(...functionFiles(full));
    else if (/\.(ts|js|mjs|cjs)$/.test(name) && !name.endsWith('.d.ts')) found.push(path.relative(ROOT, full).replace(/\\/g, '/'));
  }
  return found;
}

describe('Vercel deployment config', () => {
  it('stays within the Hobby plan limit of 12 serverless functions', () => {
    const files = functionFiles(API_DIR);
    expect(files.length, `functions found: ${files.join(', ')}`).toBeLessThanOrEqual(12);
  });

  it('schedules the daily log cleanup, and its path reaches the purge handler in api/traces', () => {
    const cron = (vercel.crons || []).find((c: any) => c.path === '/api/cron/purge-logs');
    expect(cron, 'crons entry for /api/cron/purge-logs').toBeDefined();
    // Once a day: allowed on the Hobby plan
    expect(cron.schedule).toMatch(/^\d{1,2} \d{1,2} \* \* \*$/);

    const rewrite = (vercel.rewrites || []).find((r: any) => r.source === '/api/cron/purge-logs');
    expect(rewrite?.destination).toBe('/api/traces?action=purge-logs');
    // The rewrite must come before the catch-all that sends non-API paths to the app
    const index = vercel.rewrites.indexOf(rewrite);
    const catchAll = vercel.rewrites.findIndex((r: any) => r.destination === '/index.html');
    expect(index).toBeLessThan(catchAll);
  });

  it('keeps the function time limit the AI deadline is built around', () => {
    expect(vercel.functions?.['api/**/*.ts']?.maxDuration).toBe(60);
  });
});
