#!/usr/bin/env node
// READ-ONLY growth and health report. Counts and sizes only; account ids are shortened.
//   node db/stats.mjs            (reads only DATABASE_URL_DEV; prints the host, never the password)
// Run it on production once a week (db/RUNBOOK.md section 6) and before launch. Exit code 1 when there are warnings.
import { neon } from '@neondatabase/serverless';
import { targetUrl } from './target.mjs';
import { collectStats } from './lib/stats.mjs';

const sql = neon(targetUrl());
const s = await collectStats(sql);
const mb = (b) => `${(b / 1048576).toFixed(1)} MB`;

console.log(`\nDatabase size: ${mb(s.databaseBytes)}`);
console.log('\nTable            rows        size');
for (const t of s.tables) console.log(`${t.name.padEnd(16)} ${String(t.rows).padStart(9)}  ${mb(t.bytes).padStart(10)}`);
if (s.missing.length) console.log(`(not found: ${s.missing.join(', ')})`);
console.log(`\nLast 24 hours: ${Object.entries(s.last24h).map(([k, v]) => `${k} ${v}`).join(', ')}`);
console.log(`Rows past their keep time (cleanup behind if > 0): ${Object.entries(s.overdue).map(([k, v]) => `${k} ${v}`).join(', ')}`);
console.log(`Oldest row (days): ${Object.entries(s.oldestDays).map(([k, v]) => `${k} ${v ?? '-'}`).join(', ')}`);
console.log('\nBusiest accounts (shortened ids):');
for (const u of s.topUsers) console.log(`  ${u.user.padEnd(10)} prompts ${u.prompts}  workflows ${u.workflows}  usage records (24h) ${u.traces24h}`);
console.log(s.warnings.length ? `\nWARNINGS:\n${s.warnings.map((w) => `  - ${w}`).join('\n')}` : '\nNo warnings.');
process.exit(s.warnings.length ? 1 : 0);
