// Desktop sign-in runs in the system browser on the app's loopback page (http://127.0.0.1:<port>).
// The round trip through Google/GitHub can drop the "#/browser-auth-callback?nonce=..." part of the
// return URL, so the tab keeps its pending sign-in in sessionStorage/localStorage (no token) and can
// still finish the hand-off to the desktop app. The nonce is still checked by dist-electron/main.js.
const STORAGE_KEY = 'bedrock_desktop_auth_pending';
const MAX_AGE_MS = 10 * 60 * 1000; // same lifetime as AUTH_NONCE_TTL_MS in dist-electron/main.js
const NONCE_RE = /^[A-Za-z0-9_-]{8,128}$/; // same as AUTH_NONCE_RE in dist-electron/main.js
const PORT_RE = /^[1-9]\d{0,4}$/;
const STRATEGY_RE = /^oauth_[a-z0-9_]{1,32}$/;

export interface PendingDesktopAuth {
  nonce: string;
  port: string;
  strategy: string;
}

function currentPort(): string {
  try {
    if (typeof window !== 'undefined' && window.location?.port) {
      return window.location.port;
    }
  } catch {
    // ignore
  }
  return '';
}

function getStorage(type: 'session' | 'local'): Storage | null {
  try {
    if (type === 'session') {
      if (typeof sessionStorage !== 'undefined') return sessionStorage;
      if (typeof window !== 'undefined' && window.sessionStorage) return window.sessionStorage;
    } else {
      if (typeof localStorage !== 'undefined') return localStorage;
      if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    }
  } catch {
    // blocked
  }
  return null;
}

function isValid(p: Partial<PendingDesktopAuth> | null | undefined): p is PendingDesktopAuth {
  return (
    !!p &&
    typeof p.nonce === 'string' && NONCE_RE.test(p.nonce) &&
    typeof p.port === 'string' && PORT_RE.test(p.port) && p.port === currentPort() &&
    typeof p.strategy === 'string' && STRATEGY_RE.test(p.strategy)
  );
}

export function savePendingDesktopAuth(pending: PendingDesktopAuth): void {
  if (!isValid(pending)) return;
  try {
    const { nonce, port, strategy } = pending;
    const payload = JSON.stringify({ nonce, port, strategy, createdAt: Date.now() });
    getStorage('session')?.setItem(STORAGE_KEY, payload);
    getStorage('local')?.setItem(STORAGE_KEY, payload);
  } catch {
    // storage blocked: the normal #/browser-auth-callback route still works
  }
}

export function loadPendingDesktopAuth(): PendingDesktopAuth | null {
  try {
    const session = getStorage('session');
    const local = getStorage('local');
    const raw = session?.getItem(STORAGE_KEY) || local?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const fresh = typeof parsed?.createdAt === 'number' && Date.now() - parsed.createdAt < MAX_AGE_MS;
    if (!fresh || !isValid(parsed)) {
      session?.removeItem(STORAGE_KEY);
      local?.removeItem(STORAGE_KEY);
      return null;
    }
    return { nonce: parsed.nonce, port: parsed.port, strategy: parsed.strategy };
  } catch {
    return null;
  }
}

export function clearPendingDesktopAuth(): void {
  try {
    getStorage('session')?.removeItem(STORAGE_KEY);
    getStorage('local')?.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
