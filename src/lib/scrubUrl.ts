// Crash reports (Sentry) record request URLs in breadcrumbs, errors, performance spans and session replays.
// A URL can carry a secret in its query or hash (an API key, a token, an OAuth code, the desktop sign-in
// payload), so the values of such parameters are replaced before anything leaves the browser.

const SENSITIVE_PARAM_RE =
  /^(key|api[_-]?key|apikey|x-goog-api-key|token|access[_-]?token|refresh[_-]?token|id[_-]?token|auth|authorization|password|passwd|secret|client[_-]?secret|signature|sig|ticket|code|nonce|session|__session|__clerk_db_jwt|__clerk_handshake|data)$/i;

// name=value pairs after ?, & or # anywhere in a text (a URL, or "POST https://...?key=..." span names)
const PARAM_RE = /([?&#])([^=&#?\s"'<>]+)=([^&#\s"'<>]*)/g;

export const REDACTED = '[redacted]';

/** Replaces the values of secret-looking URL parameters in any text. Other text is unchanged. */
export function scrubSensitiveUrl(text: string): string {
  if (!text.includes('=')) return text;
  return text.replace(PARAM_RE, (whole, sep: string, name: string, value: string) => {
    let decoded = name;
    try {
      decoded = decodeURIComponent(name);
    } catch {
      // keep the raw name
    }
    return SENSITIVE_PARAM_RE.test(decoded) && value !== '' ? `${sep}${name}=${REDACTED}` : whole;
  });
}

// Secrets recognisable by their shape, wherever they appear (an error message, a log line, an element text).
// Always applied: unlike the user's "secret scrubbing" setting, telemetry has no off switch for this.
const SECRET_SHAPES: Array<[RegExp, string]> = [
  [/\bsk-[A-Za-z0-9][A-Za-z0-9_-]{19,}/g, REDACTED], // OpenAI (sk-proj-), Anthropic (sk-ant-), OpenRouter (sk-or-v1-), DeepSeek
  [/\bsk_(?:live|test)_[A-Za-z0-9]{16,}/g, REDACTED], // Clerk / Stripe secret key
  [/\bAIza[0-9A-Za-z_-]{35}/g, REDACTED], // Google
  [/\b(?:gsk|hf|ghp|github_pat)_[A-Za-z0-9_]{20,}/g, REDACTED], // Groq, Hugging Face, GitHub
  [/\b(?:xai|pplx)-[A-Za-z0-9]{20,}/g, REDACTED], // xAI, Perplexity
  [/\bwhsec_[A-Za-z0-9+/=]{16,}/g, REDACTED], // webhook signing secret
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, REDACTED], // JWT (session token)
  [/\b(Bearer)\s+[A-Za-z0-9._~+/=-]{16,}/gi, `$1 ${REDACTED}`],
  [/(postgres(?:ql)?:\/\/[^:\s/@]+:)[^@\s]+@/gi, `$1${REDACTED}@`], // database password in a connection string
];

/** Hides secret-looking URL parameters and secret-shaped values (API keys, tokens) in any text. */
export function scrubText(text: string): string {
  let out = scrubSensitiveUrl(text);
  for (const [re, replacement] of SECRET_SHAPES) out = out.replace(re, replacement);
  return out;
}

/** Scrubs every string inside an object (Sentry event, breadcrumb, span, replay event) in place; returns it. */
export function scrubDeep<T>(value: T, depth = 0): T {
  if (depth > 12 || value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const item = value[i];
      if (typeof item === 'string') value[i] = scrubText(item);
      else if (typeof item === 'object') scrubDeep(item, depth + 1);
    }
    return value;
  }
  if (typeof value === 'object') {
    for (const k of Object.keys(value as Record<string, unknown>)) {
      const item = (value as Record<string, unknown>)[k];
      if (typeof item === 'string') (value as Record<string, unknown>)[k] = scrubText(item);
      else if (typeof item === 'object') scrubDeep(item, depth + 1);
    }
  }
  return value;
}
