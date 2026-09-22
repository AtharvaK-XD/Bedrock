import { useState, useEffect } from 'react';

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
  const [session, setSession] = useState<AuthSession>(getStoredSession);

  useEffect(() => {
    const syncAuth = () => {
      setSession(getStoredSession());
    };

    window.addEventListener(AUTH_UPDATE_EVENT, syncAuth);
    window.addEventListener('storage', syncAuth);

    return () => {
      window.removeEventListener(AUTH_UPDATE_EVENT, syncAuth);
      window.removeEventListener('storage', syncAuth);
    };
  }, []);

  const login = async (email: string, password?: string, name?: string, mode: 'login'|'register' = 'login') => {
    try {
      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: password || 'default_pass', name: name || email.split('@')[0] })
      });
      if (!res.ok) throw new Error('Auth failed');
      const data = await res.json();
      
      const newSession: AuthSession = {
        isLoggedIn: true,
        email: data.user.email,
        name: data.user.name,
        loginTime: new Date().toISOString(),
      };
      
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(newSession));
      setSession(newSession);
      window.dispatchEvent(new Event(AUTH_UPDATE_EVENT));
    } catch (e) {
      console.error('Failed to auth', e);
      throw e;
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (e) {
      console.error('Failed to logout', e);
    }
    setSession({ isLoggedIn: false });
    window.dispatchEvent(new Event(AUTH_UPDATE_EVENT));
  };

  return {
    isLoggedIn: session.isLoggedIn,
    session,
    login,
    logout,
    hasApiKeysConfigured,
  };
}
