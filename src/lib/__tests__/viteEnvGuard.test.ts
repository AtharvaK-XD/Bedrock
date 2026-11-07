import { describe, expect, it } from 'vitest';
import { isSecretLikeViteVar, KNOWN_SERVER_ONLY_VITE_VARS } from '../../../viteEnvGuard';

describe('isSecretLikeViteVar', () => {
  it('flags every name that was already known to be server-only', () => {
    for (const name of KNOWN_SERVER_ONLY_VITE_VARS) expect(isSecretLikeViteVar(name), name).toBe(true);
  });

  it('flags provider keys that were missing from the old fixed list (the app reads these names)', () => {
    for (const name of [
      'VITE_COHERE_API_KEY', 'VITE_DEEPSEEK_API_KEY', 'VITE_HF_API_KEY', 'VITE_MISTRAL_API_KEY',
      'VITE_NVIDIA_API_KEY', 'VITE_XAI_API_KEY', 'VITE_PERPLEXITY_API_KEY',
    ]) {
      expect(isSecretLikeViteVar(name), name).toBe(true);
    }
  });

  it('flags other secret-looking names', () => {
    for (const name of [
      'VITE_STRIPE_SECRET', 'VITE_JWT_PRIVATE_KEY', 'VITE_DB_PASSWORD', 'VITE_AWS_ACCESS_KEY_ID', 'VITE_SUPABASE_SERVICE_ROLE',
      'VITE_POSTGRES_CONNECTION_STRING', 'VITE_SENTRY_AUTH_TOKEN', 'vite_lowercase_api_key',
    ]) {
      expect(isSecretLikeViteVar(name), name).toBe(true);
    }
  });

  it('lets the public ones through', () => {
    for (const name of ['VITE_CLERK_PUBLISHABLE_KEY', 'VITE_RAZORPAY_KEY_ID', 'VITE_POSTHOG_PROJECT_TOKEN', 'VITE_POSTHOG_HOST', 'VITE_APP_VERSION', 'VITE_SENTRY_DSN']) {
      expect(isSecretLikeViteVar(name), name).toBe(false);
    }
  });
});
