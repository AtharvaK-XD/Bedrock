// Replaces real personal data on a DEV copy of the database with fake data (used by db/anonymize-dev.mjs; tested on
// in-memory Postgres). It only runs on a database that carries the dev marker ("bedrock_environment" holds 'dev').
// Production never gets that marker, and a Neon branch copied FROM production only has it if production had it.
// Row counts, sizes and the shape of the data stay realistic: texts become filler of the same length.
// Everything runs in ONE transaction (all or nothing).

export async function isMarkedDev(sql) {
  const [t] = await sql.query(`SELECT to_regclass('public.bedrock_environment') IS NOT NULL AS ok`);
  if (!t.ok) return false;
  return (await sql.query(`SELECT 1 FROM bedrock_environment WHERE name = 'dev'`)).length > 0;
}

export async function markDev(sql) {
  await sql.query(`CREATE TABLE IF NOT EXISTS bedrock_environment (name TEXT PRIMARY KEY)`);
  await sql.query(`INSERT INTO bedrock_environment(name) VALUES ('dev') ON CONFLICT DO NOTHING`);
}

const filler = (col) => `left(repeat('lorem ipsum dolor sit amet ', ceil(char_length(${col}) / 27.0)::int + 1), char_length(${col}))`;

export async function anonymize(sql) {
  if (!(await isMarkedDev(sql))) {
    throw new Error('This database is not marked as a dev database (bedrock_environment). Refusing. Nothing was changed.');
  }
  // Onboarding answers (migration 0018) are personal data. A copy that has not run 0018 yet has no such columns.
  const onboardingCols = await sql.query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User' AND column_name IN ('birth_date', 'referral_source')",
  );
  const scrubOnboarding = onboardingCols.map((r) => `${r.column_name} = NULL, `).join('');
  const results = await sql.transaction((tx) => [
    // accounts: fake but unique, stable per id
    tx.query(`UPDATE "User" SET
        email = 'user_' || substr(md5(id), 1, 12) || '@example.invalid',
        name = 'Test User ' || substr(md5(id), 1, 4),
        username = CASE WHEN username IS NULL THEN NULL ELSE 'user_' || substr(md5(id), 1, 12) END,
        avatar_url = NULL, avatar_initials = 'TU', bio = NULL, location = NULL, organization = NULL,
        github = NULL, huggingface = NULL, website = NULL, ${scrubOnboarding}password_hash = 'x',
        razorpay_customer_id = NULL, razorpay_subscription_id = NULL, updated_at = now()`),
    tx.query(`UPDATE "Prompt" SET title = 'Test prompt ' || substr(md5(id), 1, 6), snippet = ${filler('snippet')},
        full_content = ${filler('full_content')}, tags = '["Test"]'`),
    tx.query(`UPDATE "BranchingTree" SET title = 'Test workflow ' || substr(md5(id), 1, 6), nodes = '[]', edges = '[]'`),
    // logs hold IP addresses and free text and cannot be edited (0011 guard): delete them
    tx.query(`DELETE FROM "SecurityLog"`),
    tx.query(`DELETE FROM "QuotaEvent"`),
    tx.query(`DELETE FROM "IdempotencyKey"`),
    // any other table that references an account (outside this plan): delete its rows on the dev copy
    tx.query(`DO $$
      DECLARE r record;
      BEGIN
        FOR r IN
          SELECT c.conrelid::regclass::text AS tbl FROM pg_constraint c
          WHERE c.contype = 'f' AND c.confrelid = '"User"'::regclass
            AND c.conrelid::regclass::text NOT IN ('"Prompt"', '"BranchingTree"', '"Trace"', '"SecurityLog"')
        LOOP
          EXECUTE format('DELETE FROM %s', r.tbl);
        END LOOP;
      END $$`),
    tx.query(`SELECT count(*)::int AS users, count(*) FILTER (WHERE email NOT LIKE '%@example.invalid')::int AS real_emails FROM "User"`),
  ]);
  return results[results.length - 1][0];
}
