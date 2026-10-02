import { useState, useEffect } from 'react';
import { useAuth as useClerkAuth, useUser } from '@clerk/react';

const AUTH_STORAGE_KEY = 'bedrock_auth_session';
const AUTH_UPDATE_EVENT = 'bedrock_auth_update';
const API_KEYS_STORAGE_KEY = 'bedrock_api_keys';

export interface AuthSession {
  isLoggedIn: boolean;
  email?: string;
  name?: string;
  loginTime?: string;
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

function getStoredSession(): AuthSession {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return { isLoggedIn: false };
    return JSON.parse(raw);
  } catch {
    return { isLoggedIn: false };
  }
}

export function useAuth() {
  const [localSession, setLocalSession] = useState<AuthSession>(getStoredSession);
  const clerkAuth = useClerkAuth();
  const { user } = useUser();

  useEffect(() => {
    const syncAuth = () => {
      setLocalSession(getStoredSession());
    };

    window.addEventListener(AUTH_UPDATE_EVENT, syncAuth);
    window.addEventListener('storage', syncAuth);

    return () => {
      window.removeEventListener(AUTH_UPDATE_EVENT, syncAuth);
      window.removeEventListener('storage', syncAuth);
    };
  }, []);

  const isClerkLoggedIn = Boolean(clerkAuth?.userId);
  const isLoggedIn = isClerkLoggedIn || localSession.isLoggedIn;
  const isLoaded = clerkAuth ? clerkAuth.isLoaded : true;

  const session: AuthSession = isClerkLoggedIn
    ? {
        isLoggedIn: true,
        email: user?.primaryEmailAddress?.emailAddress || localSession.email,
        name: user?.fullName || user?.firstName || localSession.name,
        loginTime: user?.lastSignInAt ? new Date(user.lastSignInAt).toISOString() : localSession.loginTime,
      }
    : localSession;

  const login = async (email: string, _password?: string, name?: string, _mode: 'login'|'register' = 'login') => {
    const userEmail = email.trim() || 'developer@bedrock.app';
    const userName = name?.trim() || (userEmail.includes('@') ? userEmail.split('@')[0] : 'Engineer');
    const newSession: AuthSession = {
      isLoggedIn: true,
      email: userEmail,
      name: userName,
      loginTime: new Date().toISOString(),
    };
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newSession));
    } catch (e) {
      console.error('Failed to save auth session', e);
    }
    setLocalSession(newSession);
    window.dispatchEvent(new Event(AUTH_UPDATE_EVENT));
  };

  const logout = async () => {
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
    } catch (e) {
      console.error('Failed to clear local auth session', e);
    }
    setLocalSession({ isLoggedIn: false });
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
