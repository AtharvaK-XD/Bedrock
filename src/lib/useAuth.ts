import { useAuth as useClerkAuth, useUser } from '@clerk/react';

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

export function useAuth() {
  const { userId, signOut } = useClerkAuth();
  const { user } = useUser();

  const isLoggedIn = !!userId;

  const session: AuthSession = {
    isLoggedIn,
    email: user?.primaryEmailAddress?.emailAddress,
    name: user?.fullName || user?.firstName || undefined,
    loginTime: user?.lastSignInAt ? new Date(user.lastSignInAt).toISOString() : undefined,
  };

  const login = async (_email: string, _password?: string, _name?: string, _mode: 'login'|'register' = 'login') => {
    console.warn("Traditional login called - please use Clerk components for authentication.");
  };

  const logout = async () => {
    try {
      await signOut();
    } catch (e) {
      console.error('Failed to logout via Clerk', e);
    }
  };

  return {
    isLoggedIn,
    session,
    login,
    logout,
    hasApiKeysConfigured,
  };
}
