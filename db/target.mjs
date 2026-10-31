// Shared target check for the db/ scripts that WRITE (migrate, roles, flood test).
// Reads only DATABASE_URL_DEV and prints the host, never the password.
// Writing needs BOTH --yes and --host <exact host printed>, so a wrong value in DATABASE_URL_DEV (for example a
// production string left over from a release) cannot be written to by a habit-typed "--yes".
export function targetUrl() {
  const url = (process.env.DATABASE_URL_DEV || '').trim().replace(/^"|"$/g, '');
  if (!url) {
    console.error('DATABASE_URL_DEV is not set. Point it at a Neon DEV branch (never production). Nothing was done.');
    process.exit(1);
  }
  console.log(`Target database host: ${new URL(url).host}`);
  return url;
}

export function confirmWrite(url, flags, what) {
  const host = new URL(url).host;
  const hostIdx = flags.indexOf('--host');
  const given = hostIdx >= 0 ? flags[hostIdx + 1] : null;
  if (!flags.includes('--yes') || given !== host) {
    console.error(`Refusing to ${what}. To confirm, add: --yes --host ${host}`);
    process.exit(1);
  }
}
