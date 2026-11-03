import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Quality evaluation of the AI prompts (live, paid AI calls). NOT part of `npx vitest run` or CI:
// the default test pattern only picks up *.test.ts, these files are *.eval.ts.
// Run: npx vitest run --config api/_lib/__eval__/vitest.eval.config.ts
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

export default defineConfig({
  root,
  test: {
    include: ['api/_lib/__eval__/**/*.eval.ts'],
    testTimeout: 6 * 60 * 60 * 1000,
    hookTimeout: 60 * 1000,
    fileParallelism: false,
  },
});
