#!/usr/bin/env node
// READ-ONLY readiness report: migrations, what is therefore ON or OFF, roles and rights, cleanup health.
//   node db/readiness.mjs            (reads only DATABASE_URL_DEV; prints the host, never the password)
// Safe on production: it writes nothing and creates nothing. Counts only. Exit code 1 when anything is not ready.
// Use it for the first look at production (db/PRODUCTION.md step 1) and again after every rollout step.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';
import { targetUrl } from './target.mjs';
import { collectReadiness } from './lib/readiness.mjs';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');
const sql = neon(targetUrl());
try {
  const r = await collectReadiness(sql, { dir });
  console.log('\nFeatures (ON = its migration is applied here):');
  for (const f of r.features) console.log(`  ${f.on ? 'ON ' : 'OFF'}  ${f.migration}  ${f.feature}`);
  console.log(`\nThis connection is the role: ${r.role.connectedAs}${r.role.connectedRoleIsPowerful ? ' (owner-level: can change the schema)' : ''}`);
  console.log(`Limited app role bedrock_app: ${r.role.appRoleExists ? 'exists' : 'does not exist yet'}`);
  const t = r.stats.tables.map((x) => `${x.name} ${x.rows}`).join(', ');
  console.log(`Rows: ${t}`);
  for (const n of r.notes) console.log(`NOTE  ${n}`);
  if (r.problems.length === 0) {
    console.log('\nREADY: no problems found on this database.');
  } else {
    console.log('\nNOT READY:');
    for (const p of r.problems) console.log(`  - ${p}`);
  }
  process.exit(r.problems.length === 0 ? 0 : 1);
} catch (e) {
  console.error(`STOPPED: ${e.message}`);
  process.exit(2);
}
