#!/usr/bin/env node
// Replaces real personal data on the DEV branch with fake data. Never runs on a database without the dev marker.
//   node db/anonymize-dev.mjs --mark-dev --yes --host <host>   (once: marks THIS database as dev)
//   node db/anonymize-dev.mjs --yes --host <host>              (anonymize; refuses if not marked dev)
// Reads only DATABASE_URL_DEV; writing needs --yes AND the exact host it printed (db/target.mjs).
// Do NOT mark a production database. Marking is the only thing that unlocks this tool.
import { neon } from '@neondatabase/serverless';
import { targetUrl, confirmWrite } from './target.mjs';
import { anonymize, isMarkedDev, markDev } from './lib/anonymize.mjs';

const flags = process.argv.slice(2);
const url = targetUrl();
confirmWrite(url, flags, flags.includes('--mark-dev') ? 'mark this database as dev' : 'replace personal data with fake data');
const sql = neon(url);

try {
  if (flags.includes('--mark-dev')) {
    await markDev(sql);
    console.log('Marked as dev (bedrock_environment). Now run this tool without --mark-dev.');
  } else {
    if (!(await isMarkedDev(sql))) {
      console.error('This database is not marked as dev. Refusing. (If it really is your dev branch: --mark-dev once.)');
      process.exit(1);
    }
    const r = await anonymize(sql);
    console.log(`done: ${r.users} account(s) now fake; real e-mail addresses left: ${r.real_emails}`);
    process.exit(r.real_emails === 0 ? 0 : 1);
  }
} catch (e) {
  console.error(`STOPPED: ${e.message}`);
  process.exit(1);
}
