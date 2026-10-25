import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth as useClerkAuth, useUser } from '@clerk/react';

const AUTH_STORAGE_KEY = 'bedrock_auth_session';
const AUTH_UPDATE_EVENT = 'bedrock_auth_update';
const API_KEYS_STORAGE_KEY = 'bedrock_api_keys';

// 7 days of inactivity in milliseconds (7 * 24 * 60 * 60 * 1000)
export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
// Throttle activity updates to at most once every 60 seconds
const ACTIVITY_THROTTLE_MS = 60 * 1000;

export interface AuthSession {
  isLoggedIn: boolean;
  email?: string;
  name?: string;
  loginTime?: string;
  lastActiveAt?: number;
}

export function hasApiKeysConfigured(): boolean {
  try {
    const raw = localStorage.getItem(API_KEYS_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Boolean(
      (parsed.geminiKey && parsed.geminiKey.trim().length > 0) ||
      (parsed.groqKey && parsed.groqKey.trim().length > 0) ||
      (parsed.openAiKey && parsed.openAiKey.trim().length > 0) ||
      (parsed.anthropicKey && parsed.anthropicKey.trim().length > 0) ||
      (parsed.openRouterKey && parsed.openRouterKey.trim().length > 0) ||
      (parsed.huggingFaceKey && parsed.huggingFaceKey.trim().length > 0)
    );
  } catch {
    return false;
  }
}

export function isSessionExpired(session: AuthSession): boolean {
  if (!session.isLoggedIn) return true;
  const now = Date.now();

  // Primary check: last active activity timestamp
  if (typeof session.lastActiveAt === 'number' && !isNaN(session.lastActiveAt)) {
    return now - session.lastActiveAt > SEVEN_DAYS_MS;
  }

  // Fallback check: initial login time
  if (session.loginTime) {
    const loginTimestamp = new Date(session.loginTime).getTime();
    if (!isNaN(loginTimestamp)) {
      return now - loginTimestamp > SEVEN_DAYS_MS;
    }
  }

  return false;
}

function getStoredSession(): AuthSession {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return { isLoggedIn: false };
    const parsed: AuthSession = JSON.parse(raw);

    if (parsed.isLoggedIn) {
      if (isSessionExpired(parsed)) {
        try {
          localStorage.removeItem(AUTH_STORAGE_KEY);
          localStorage.removeItem('bedrock_auth_event');
          localStorage.removeItem('bedrock_active_user_id');
        } catch {}
        return { isLoggedIn: false };
      }

      // Backfill lastActiveAt if missing
      if (typeof parsed.lastActiveAt !== 'number') {
        parsed.lastActiveAt = Date.now();
        try {
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(parsed));
        } catch {}
      }
      return parsed;
    }

    return { isLoggedIn: false };
  } catch {
    return { isLoggedIn: false };
  }
}

export function useAuth() {
  const [localSession, setLocalSession] = useState<AuthSession>(getStoredSession);
  const clerkAuth = useClerkAuth();
  const { user } = useUser();
  const lastTouchRef = useRef<number>(Date.now());

  const isClerkLoggedIn = Boolean(
    clerkAuth?.userId ||
    (typeof window !== 'undefined' && ((window as any).Clerk?.session || (window as any).Clerk?.user))
  );

  const isExpired = localSession.isLoggedIn && isSessionExpired(localSession);
  const isLoggedIn = !isExpired && (isClerkLoggedIn || localSession.isLoggedIn);
  const isLoaded = clerkAuth ? clerkAuth.isLoaded : true;

  const logout = useCallback(async () => {
    try {
      if (clerkAuth?.signOut) {
        await clerkAuth.signOut();
      } else if (typeof (window as any).Clerk?.signOut === 'function') {
        await (window as any).Clerk.signOut();
      }
    } catch (e) {
      console.error('Failed to logout via Clerk', e);
    }
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem('bedrock_auth_event');
      localStorage.removeItem('bedrock_active_user_id');
      sessionStorage.clear();
    } catch (e) {
      console.error('Failed to clear local auth session', e);
    }
    setLocalSession({ isLoggedIn: false });
    window.dispatchEvent(new Event(AUTH_UPDATE_EVENT));
  }, [clerkAuth]);

  // Sync auth state across windows/tabs
  useEffect(() => {
    const syncAuth = () => {
      const stored = getStoredSession();
      if (stored.isLoggedIn && isSessionExpired(stored)) {
        logout();
      } else {
        setLocalSession(stored);
      }
    };

    window.addEventListener(AUTH_UPDATE_EVENT, syncAuth);
    window.addEventListener('storage', syncAuth);

    return () => {
      window.removeEventListener(AUTH_UPDATE_EVENT, syncAuth);
      window.removeEventListener('storage', syncAuth);
    };
  }, [logout]);

  // Enforce 7-day inactivity check on Clerk user
  useEffect(() => {
    if (isClerkLoggedIn) {
      try {
        const raw = localStorage.getItem(AUTH_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.isLoggedIn && isSessionExpired(parsed)) {
            // Strictly expire user after 7 days of inactivity
            logout();
            return;
          }
        }
      } catch {}
    }
  }, [isClerkLoggedIn, logout]);

  // Persist session into local storage when Clerk user signs in
  useEffect(() => {
    if (isClerkLoggedIn && !isExpired) {
      const activeUser = user || (typeof window !== 'undefined' ? (window as any).Clerk?.user : null);
      const email = activeUser?.primaryEmailAddress?.emailAddress || activeUser?.emailAddresses?.[0]?.emailAddress;
      const name = activeUser?.fullName || activeUser?.firstName || (email ? email.split('@')[0] : undefined);
      
      if (email && (!localSession.isLoggedIn || typeof localSession.lastActiveAt !== 'number')) {
        const now = Date.now();
        const sessionData: AuthSession = {
          isLoggedIn: true,
          email,
          name: name || 'Developer',
          loginTime: new Date().toISOString(),
          lastActiveAt: now,
        };
        try {
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(sessionData));
        } catch {}
        setLocalSession(sessionData);
      }
    }
  }, [isClerkLoggedIn, isExpired, user, localSession.isLoggedIn, localSession.lastActiveAt]);

  // Rolling activity tracker: updates lastActiveAt when the user interacts with Bedrock
  useEffect(() => {
    if (!isLoggedIn) return;

    const touchActivity = () => {
      const now = Date.now();
      if (now - lastTouchRef.current < ACTIVITY_THROTTLE_MS) return;
      lastTouchRef.current = now;

      try {
        const raw = localStorage.getItem(AUTH_STORAGE_KEY);
        if (!raw) return;
        const parsed: AuthSession = JSON.parse(raw);
        if (!parsed.isLoggedIn) return;

        // If expired while idle, force logout
        if (isSessionExpired(parsed)) {
          logout();
          return;
        }

        parsed.lastActiveAt = now;
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(parsed));
      } catch {}
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const stored = getStoredSession();
        if (stored.isLoggedIn && isSessionExpired(stored)) {
          logout();
        } else {
          touchActivity();
        }
      }
    };

    window.addEventListener('pointerdown', touchActivity, { passive: true });
    window.addEventListener('keydown', touchActivity, { passive: true });
    window.addEventListener('scroll', touchActivity, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pointerdown', touchActivity);
      window.removeEventListener('keydown', touchActivity);
      window.removeEventListener('scroll', touchActivity);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isLoggedIn, logout]);

  const session: AuthSession = isClerkLoggedIn && !isExpired
    ? {
        isLoggedIn: true,
        email: user?.primaryEmailAddress?.emailAddress || localSession.email,
        name: user?.fullName || user?.firstName || localSession.name,
        loginTime: user?.lastSignInAt ? new Date(user.lastSignInAt).toISOString() : localSession.loginTime,
        lastActiveAt: localSession.lastActiveAt || Date.now(),
      }
    : localSession;

  const login = async (email: string, _password?: string, name?: string, _mode: 'login'|'register' = 'login') => {
    const userEmail = email.trim() || 'developer@bedrock.app';
    const userName = name?.trim() || (userEmail.includes('@') ? userEmail.split('@')[0] : 'Engineer');
    const now = Date.now();
    const newSession: AuthSession = {
      isLoggedIn: true,
      email: userEmail,
      name: userName,
      loginTime: new Date().toISOString(),
      lastActiveAt: now,
    };
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newSession));
    } catch (e) {
      console.error('Failed to save auth session', e);
    }
    setLocalSession(newSession);
    window.dispatchEvent(new Event(AUTH_UPDATE_EVENT));
  };

  return {
    isLoggedIn,
    isLoaded,
    session,
    login,
    logout,
    hasApiKeysConfigured,
  };
}
