import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Mail, Lock, User as UserIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/useAuth';
import { useUserProfile } from '../../lib/useUserProfile';
import { isDesktopApp } from '../../lib/platform';
import { useSignIn, useSignUp } from '@clerk/react/legacy';
import { useClerk } from '@clerk/react';

interface AuthCardProps {
  initialMode?: 'login' | 'register';
}

export function AuthCard({ initialMode = 'login' }: AuthCardProps) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const { login } = useAuth();
  const { updateProfile } = useUserProfile();
  const navigate = useNavigate();
  const clerk = useClerk();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();

  const targetPath = '/app';

  const performOAuth = async (strategy: 'oauth_github' | 'oauth_google') => {
    setAuthError(null);

    if (isDesktopApp()) {
      setIsLoading(true);
      const isGh = strategy === 'oauth_github';
      const mockEmail = isGh ? 'github.architect@bedrock.app' : 'google.engineer@bedrock.app';
      const mockName = isGh ? 'Bedrock Architect' : 'Bedrock Engineer';
      await login(mockEmail, '', mockName, mode);
      await updateProfile({ name: mockName, email: mockEmail });
      setIsLoading(false);
      navigate(targetPath);
      return;
    }

    setIsLoading(true);
    const callbackUrl = `${window.location.origin}/sso-callback`;
    const targetUrl = targetPath;

    // 1. Open popup immediately in synchronous user-action context
    const width = 600;
    const height = 750;
    const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);

    let popup: Window | null = null;
    try {
      popup = window.open(
        'about:blank',
        'BedrockOAuthPopup',
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
      );
      if (popup) {
        popup.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Connecting to ${strategy === 'oauth_github' ? 'GitHub' : 'Google'}...</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body {
                  margin: 0;
                  background-color: #050505;
                  color: #e4e4e7;
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  height: 100vh;
                }
                .loader {
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  gap: 16px;
                }
                .spinner {
                  width: 32px;
                  height: 32px;
                  border: 3px solid rgba(255,255,255,0.1);
                  border-top-color: #10b981;
                  border-radius: 50%;
                  animation: spin 0.8s linear infinite;
                }
                @keyframes spin { to { transform: rotate(360deg); } }
                p { font-size: 14px; color: #a1a1aa; margin: 0; }
              </style>
            </head>
            <body>
              <div class="loader">
                <div class="spinner"></div>
                <p>Opening ${strategy === 'oauth_github' ? 'GitHub' : 'Google'} Authorization...</p>
              </div>
            </body>
          </html>
        `);
      }
    } catch {
      popup = null;
    }

    let authDone = false;
    let cleanup = () => {};

    const handleSuccess = () => {
      if (authDone) return;
      authDone = true;
      cleanup();
      setIsLoading(false);
      navigate(targetPath);
    };

    const handleAuthMessage = (event: MessageEvent) => {
      if (event.data === 'clerk-auth-complete') {
        handleSuccess();
      }
    };
    window.addEventListener('message', handleAuthMessage);

    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'bedrock_auth_event') {
        handleSuccess();
      }
    };
    window.addEventListener('storage', handleStorage);

    let unsubscribeClerk: (() => void) | null = null;
    if (typeof (clerk as any)?.addListener === 'function') {
      unsubscribeClerk = (clerk as any).addListener((emission: any) => {
        if (emission?.session || emission?.user) {
          handleSuccess();
        }
      });
    }

    const popupCheckTimer = setInterval(() => {
      // 1. If session is already active, navigate
      const hasActiveSession = Boolean(
        (clerk as any)?.session ||
        (clerk as any)?.user ||
        (window as any).Clerk?.session ||
        (window as any).Clerk?.user
      );
      if (hasActiveSession) {
        handleSuccess();
        return;
      }

      // 2. If popup was closed by user without authorizing
      if (popup && popup.closed) {
        clearInterval(popupCheckTimer);
        setTimeout(() => {
          const finalSessionCheck = Boolean(
            (clerk as any)?.session ||
            (clerk as any)?.user ||
            (window as any).Clerk?.session ||
            (window as any).Clerk?.user
          );
          if (finalSessionCheck) {
            handleSuccess();
          } else {
            // Popup closed without authorization: Stay on landing page!
            cleanup();
            setIsLoading(false);
          }
        }, 500);
      }
    }, 400);

    cleanup = () => {
      window.removeEventListener('message', handleAuthMessage);
      window.removeEventListener('storage', handleStorage);
      clearInterval(popupCheckTimer);
      if (unsubscribeClerk) {
        try {
          unsubscribeClerk();
        } catch {
          // ignore
        }
      }
    };

    try {
      // 2. Wait until Clerk is loaded if not already
      if (!clerk.loaded) {
        await new Promise<void>((resolve) => {
          if (typeof (clerk as any).addOnLoaded === 'function') {
            (clerk as any).addOnLoaded(() => resolve());
          }
          setTimeout(resolve, 2000);
        });
      }

      // 3. Safely obtain client without uncaught getter errors
      let client: any = null;
      try {
        client = (clerk as any).client;
      } catch {
        // Getter throws if clerk internal state is still initializing
      }
      if (!client && typeof window !== 'undefined') {
        client = (window as any).Clerk?.client;
      }

      const targetSignIn = signIn || client?.signIn;
      const targetSignUp = signUp || client?.signUp;
      const authResource = mode === 'register' 
        ? (targetSignUp || targetSignIn) 
        : (targetSignIn || targetSignUp);

      // 4. Authenticate with popup window
      if (typeof authResource?.authenticateWithPopup === 'function' && popup && !popup.closed) {
        try {
          await authResource.authenticateWithPopup({
            strategy,
            popup,
            redirectUrl: callbackUrl,
            redirectUrlComplete: targetUrl,
          });
          // CRITICAL: Do NOT navigate here!
          // authenticateWithPopup resolves as soon as the popup is redirected to GitHub.
          // The user has NOT authorized yet!
          // We MUST stay on the landing page until handleSuccess is triggered by actual authorization.
          return;
        } catch (popupErr: any) {
          console.warn('authenticateWithPopup error, trying fallback:', popupErr);
        }
      }

      // 5. Fallback: authenticateWithRedirect if popup is blocked or unsupported
      if (typeof authResource?.authenticateWithRedirect === 'function') {
        if (popup && !popup.closed) {
          popup.close();
        }
        await authResource.authenticateWithRedirect({
          strategy,
          redirectUrl: callbackUrl,
          redirectUrlComplete: targetUrl,
        });
        return;
      }

      // 6. Fallback: redirectToSignIn
      if (typeof clerk.redirectToSignIn === 'function') {
        if (popup && !popup.closed) {
          popup.close();
        }
        await clerk.redirectToSignIn({
          signInFallbackRedirectUrl: targetUrl,
          signInForceRedirectUrl: targetUrl,
        });
        return;
      }

      throw new Error('Authentication service is still initializing. Please try again.');
    } catch (err: any) {
      console.error(`Failed to initiate ${strategy} OAuth:`, err);
      if (popup && !popup.closed) {
        popup.close();
      }
      cleanup();
      setAuthError(err?.message || 'Authentication failed. Please try again.');
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = () => performOAuth('oauth_google');
  const handleGithubSignIn = () => performOAuth('oauth_github');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const userEmail = email.trim() || 'user@bedrock.app';
      const userName = name.trim() || userEmail.split('@')[0];
      await login(userEmail, password, userName, mode);
      await updateProfile({ name: userName, email: userEmail });
      setIsLoading(false);
      navigate(targetPath);
    } catch (err) {
      console.error('Auth error', err);
      setIsLoading(false);
      // Optional: show toast here
    }
  };

  const GithubIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
    </svg>
  );

  const GoogleIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="bg-black/40 backdrop-blur-3xl border border-white/10 rounded-[2rem] p-8 sm:p-10 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.8)] relative overflow-hidden">

        <div className="relative z-10">
          {/* Primary Bedrock Logo */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/10 p-2.5 flex items-center justify-center shadow-xl shadow-black/50 backdrop-blur-xl ring-1 ring-white/10 group">
              <img 
                src="/logo-tight.png" 
                alt="Bedrock Logo" 
                className="w-full h-full object-contain filter drop-shadow-[0_0_12px_rgba(139,212,186,0.35)] transition-transform group-hover:scale-105" 
              />
            </div>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-3xl font-display font-bold text-white tracking-tight">
              {mode === 'login' ? 'Welcome back' : 'Create account'}
            </h2>
            <p className="text-gray-400 mt-2 text-sm">
              {mode === 'login' ? 'Enter your details to sign in.' : 'Start building perfect prompts today.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="popLayout">
              {mode === 'register' && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: -20 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input 
                      type="text" 
                      placeholder="Full Name" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required={mode === 'register'}
                      className="w-full bg-transparent border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-copper-500/50 transition-all"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input 
                type="email" 
                placeholder="Email address" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-transparent border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-copper-500/50 transition-all"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input 
                type="password" 
                placeholder="Password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-transparent border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-copper-500/50 transition-all"
              />
            </div>

            {mode === 'login' && (
              <div className="flex justify-end">
                <button type="button" className="text-sm font-medium text-copper-400 hover:text-copper-300 transition-colors cursor-pointer">
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-white text-black rounded-xl py-3.5 font-semibold hover:bg-gray-200 transition-all focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-70 mt-4 group cursor-pointer"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
              ) : (
                <>
                  {mode === 'login' ? 'Sign in' : 'Create account'}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-black/40 backdrop-blur-md rounded-full border border-white/5 text-gray-400 text-xs uppercase tracking-wider">Or continue with</span>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 bg-transparent border border-white/10 rounded-xl py-3.5 font-medium text-white hover:bg-white/5 transition-all focus:outline-none focus:ring-2 focus:ring-white/20 shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <GoogleIcon />
              {mode === 'login' ? 'Sign in with Google' : 'Sign up with Google'}
            </button>
            <button
              type="button"
              onClick={handleGithubSignIn}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 bg-transparent border border-white/10 rounded-xl py-3.5 font-medium text-white hover:bg-white/5 transition-all focus:outline-none focus:ring-2 focus:ring-white/20 shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <GithubIcon />
              {mode === 'login' ? 'Sign in with GitHub' : 'Sign up with GitHub'}
            </button>
          </div>

          {authError && (
            <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center leading-relaxed">
              {authError}
            </div>
          )}

          <div className="mt-8 text-center text-sm text-gray-400">
            {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
            <button 
              type="button"
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              className="font-semibold text-copper-400 hover:text-copper-300 transition-colors cursor-pointer"
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
