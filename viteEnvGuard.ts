// Which VITE_ variables must never reach the browser. Everything named VITE_* is copied into the public
// website code and the installer, so a secret with that prefix would be readable by anyone.
// Used by vite.config.ts and tested in src/lib/__tests__/viteEnvGuard.test.ts.

/** Names that were already known to be server-only. */
export const KNOWN_SERVER_ONLY_VITE_VARS = [
  'VITE_GROQ_API_KEY',
  'VITE_GEMINI_API_KEY',
  'VITE_OPENROUTER_API_KEY',
  'VITE_HUGGINGFACE_API_KEY',
  'VITE_OPENAI_API_KEY',
  'VITE_ANTHROPIC_API_KEY',
  'VITE_DATABASE_URL',
  'VITE_NEON_DATABASE_URL',
  'VITE_RAZORPAY_KEY_SECRET',
  'VITE_UPSTASH_REDIS_REST_TOKEN',
  'VITE_CLERK_SECRET_KEY',
  'VITE_RESEND_API_KEY',
] as const;

/** Meant to be public (they are in the browser by design). */
const PUBLIC_BY_DESIGN = new Set(['VITE_CLERK_PUBLISHABLE_KEY', 'VITE_POSTHOG_PROJECT_TOKEN', 'VITE_POSTHOG_HOST']);

/** A name that says "secret": covers keys nobody listed, such as VITE_COHERE_API_KEY or VITE_HF_API_KEY. */
const SECRET_NAME_RE = /(SECRET|PRIVATE|PASSWORD|PASSWD|API_KEY|ACCESS_KEY|SERVICE_ROLE|DATABASE_URL|CONNECTION_STRING|TOKEN)/i;

export function isSecretLikeViteVar(name: string): boolean {
  if (PUBLIC_BY_DESIGN.has(name)) return false;
  return (KNOWN_SERVER_ONLY_VITE_VARS as readonly string[]).includes(name) || SECRET_NAME_RE.test(name);
}
