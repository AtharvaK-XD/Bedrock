/**
 * A "return to" address read from the page URL (for example /sso-callback?returnUrl=...) can be set by anyone who
 * sends a link. Only a path on this site is kept, so the link cannot send a signed-in user to another site
 * (open redirect, phishing) or run script (javascript:). Anything else becomes the fallback.
 *
 * Allowed: "/app", "/app/profile?tab=usage#x". Refused: "https://evil.com", "//evil.com", "/\evil.com",
 * "javascript:alert(1)", "app/profile" (not starting with "/"), text with spaces or control characters.
 */
export function safeReturnPath(raw: string | null | undefined, fallback = '/app'): string {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 500) return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback;
  // Browsers treat "\" like "/" ("/\evil.com" is another site); whitespace and control characters are never needed
  if (/[\\\s]/.test(raw)) return fallback;
  for (let i = 0; i < raw.length; i += 1) {
    const code = raw.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return fallback;
  }
  try {
    const base = 'https://bedrock.invalid';
    const url = new URL(raw, base);
    if (url.origin !== base) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
