import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Mail, Lock, User as UserIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/useAuth';
import { useUserProfile } from '../../lib/useUserProfile';
import { useSignIn, useSignUp } from '@clerk/react/legacy';
import { useClerk } from '@clerk/react';
import { isDesktopApp } from '../../lib/platform';

interface AuthCardProps {
  initialMode?: 'login' | 'register';
}

export function AuthCard({ initialMode }: AuthCardProps) {
  const isDesktop = isDesktopApp();
  const defaultMode = initialMode || (isDesktop ? 'register' : 'login');

  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(defaultMode);
  const [forgotStep, setForgotStep] = useState<'request' | 'verify'>('request');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Desktop external browser authentication state
  const [isWaitingForBrowser, setIsWaitingForBrowser] = useState(false);
  const [waitingStrategy, setWaitingStrategy] = useState<'oauth_google' | 'oauth_github'>('oauth_google');
  const [browserNonce, setBrowserNonce] = useState('');
  const pollTimerRef = useRef<any>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  const { login } = useAuth();
  const { updateProfile } = useUserProfile();
  const navigate = useNavigate();
  const clerk = useClerk();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();

  const targetPath = '/app';

  // Cleanup polling and listeners on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (unsubRef.current) unsubRef.current();
    };
  }, []);

  const handleExternalAuthSuccess = async (payload: any) => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }

    setIsWaitingForBrowser(false);
    setIsLoading(true);

    try {
      const userEmail = payload.email || 'developer@bedrock.app';
      const userName = payload.name || userEmail.split('@')[0];
      await login(userEmail, undefined, userName, mode === 'register' ? 'register' : 'login');
      await updateProfile({
        name: userName,
        email: userEmail,
        avatarUrl: payload.avatarUrl || '',
      });
      setIsLoading(false);
      navigate(targetPath);
    } catch (err: any) {
      console.error('Desktop auth completion error:', err);
      setAuthError(err?.message || 'Failed to complete desktop authentication.');
      setIsLoading(false);
    }
  };

  const cancelBrowserAuth = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
    setIsWaitingForBrowser(false);
    setIsLoading(false);
  };

  const reopenBrowserAuth = async () => {
    try {
      const electronAuth = (window as any).electronAuth;
      const ipcRenderer = (window as any).ipcRenderer;
      if (electronAuth?.startExternalAuth) {
        await electronAuth.startExternalAuth({ strategy: waitingStrategy, mode, nonce: browserNonce });
      } else if (ipcRenderer?.invoke) {
        await ipcRenderer.invoke('auth:start-external', { strategy: waitingStrategy, mode, nonce: browserNonce });
      }
    } catch (e) {
      console.warn('Reopen browser auth error:', e);
    }
  };

  const performOAuth = async (strategy: 'oauth_github' | 'oauth_google') => {
    setAuthError(null);
    setIsLoading(true);

    // If running inside Bedrock Desktop (Windows or macOS):
    // Always open in system default browser tab so Google/GitHub sessions exist and no 403 disallowed_useragent occurs!
    if (isDesktop) {
      const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
      setBrowserNonce(nonce);
      setWaitingStrategy(strategy);
      setIsWaitingForBrowser(true);
      setIsLoading(false);

      try {
        const electronAuth = (window as any).electronAuth;
        const ipcRenderer = (window as any).ipcRenderer;

        // 1. Listen via electronAuth or ipcRenderer
        if (electronAuth?.onAuthSuccess) {
          unsubRef.current = electronAuth.onAuthSuccess((payload: any) => {
            if (payload && (!payload.nonce || payload.nonce === nonce)) {
              handleExternalAuthSuccess(payload);
            }
          });
        } else if (ipcRenderer?.on) {
          const listener = (_event: any, payload: any) => {
            if (payload && (!payload.nonce || payload.nonce === nonce)) {
              handleExternalAuthSuccess(payload);
            }
          };
          ipcRenderer.on('auth:external-success', listener);
          unsubRef.current = () => ipcRenderer.off('auth:external-success', listener);
        }

        // 2. Poll loopback server as triple redundancy
        const port = window.location.port || '0';
        pollTimerRef.current = setInterval(async () => {
          try {
            const res = await fetch(`http://127.0.0.1:${port}/api/desktop-auth-status?nonce=${nonce}`);
            if (res.ok) {
              const data = await res.json();
              if (data.authenticated && data.session) {
                handleExternalAuthSuccess(data.session);
              }
            }
          } catch {
            // ignore network polling error
          }
        }, 1000);

        // 3. Launch system default browser
        if (electronAuth?.startExternalAuth) {
          await electronAuth.startExternalAuth({ strategy, mode, nonce });
        } else if (ipcRenderer?.invoke) {
          await ipcRenderer.invoke('auth:start-external', { strategy, mode, nonce });
        }
      } catch (err: any) {
        console.error('Failed to trigger external browser auth:', err);
        setAuthError(err?.message || 'Could not launch system default browser.');
        setIsWaitingForBrowser(false);
      }
      return;
    }

    // Web Browser Mode (Vercel / standard web):
    const origin = (typeof window !== 'undefined' && window.location.origin && !window.location.origin.startsWith('file'))
      ? window.location.origin
      : 'https://bedrock-steel.vercel.app';
    const callbackUrl = `${origin}/sso-callback`;
    const targetUrl = targetPath;

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

    const popupCheckTimer = setInterval(() => {
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
    };

    try {
      if (!clerk.loaded) {
        await new Promise<void>((resolve) => {
          if (typeof (clerk as any).addOnLoaded === 'function') {
            (clerk as any).addOnLoaded(() => resolve());
          }
          setTimeout(resolve, 2000);
        });
      }

      if (clerk && ((clerk as any).session || (clerk as any).user || (window as any).Clerk?.session)) {
        try {
          if (typeof clerk.signOut === 'function') {
            await clerk.signOut();
          }
        } catch {
          // ignore
        }
      }

      let client: any = null;
      try {
        client = (clerk as any).client;
      } catch {
        // ignore
      }
      if (!client && typeof window !== 'undefined') {
        client = (window as any).Clerk?.client;
      }

      const targetSignIn = signIn || client?.signIn || (clerk as any).client?.signIn;
      const targetSignUp = signUp || client?.signUp || (clerk as any).client?.signUp;
      const authResource = mode === 'register' 
        ? (targetSignUp || targetSignIn) 
        : (targetSignIn || targetSignUp);

      const oidcPrompt = 'select_account consent';

      if (typeof authResource?.authenticateWithPopup === 'function' && popup && !popup.closed) {
        try {
          await authResource.authenticateWithPopup({
            strategy,
            popup,
            redirectUrl: callbackUrl,
            redirectUrlComplete: targetUrl,
            oidcPrompt,
          });
          return;
        } catch (popupErr: any) {
          console.warn('authenticateWithPopup error, trying fallback:', popupErr);
        }
      }

      if (typeof authResource?.authenticateWithRedirect === 'function') {
        if (popup && !popup.closed) popup.close();
        await authResource.authenticateWithRedirect({
          strategy,
          redirectUrl: callbackUrl,
          redirectUrlComplete: targetUrl,
          oidcPrompt,
        });
        return;
      }

      if (typeof clerk.redirectToSignIn === 'function') {
        if (popup && !popup.closed) popup.close();
        await clerk.redirectToSignIn({
          signInFallbackRedirectUrl: targetUrl,
          signInForceRedirectUrl: targetUrl,
        });
        return;
      }

      throw new Error('Authentication service is still initializing. Please try again.');
    } catch (err: any) {
      console.error(`Failed to initiate ${strategy} OAuth:`, err);
      if (popup && !popup.closed) popup.close();
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
      await login(userEmail, password, userName, mode === 'register' ? 'register' : 'login');
      await updateProfile({ name: userName, email: userEmail });
      setIsLoading(false);
      navigate(targetPath);
    } catch (err) {
      console.error('Auth error', err);
      setIsLoading(false);
    }
  };

  const handleForgotPasswordRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setAuthError('Please enter your email address to receive the password reset code.');
      return;
    }
    setIsLoading(true);
    setAuthError(null);
    setSuccessMsg(null);

    try {
      if (clerk?.signOut && (clerk?.session || clerk?.user || (window as any).Clerk?.session)) {
        try {
          await clerk.signOut();
        } catch {
          // ignore
        }
      }

      const targetSignIn = signIn || (clerk as any).client?.signIn;
      if (targetSignIn?.create) {
        await targetSignIn.create({
          strategy: 'reset_password_email_code',
          identifier: email.trim(),
        });
        setForgotStep('verify');
        setSuccessMsg('Reset code sent! Check your inbox (and spam folder).');
      } else {
        setForgotStep('verify');
        setSuccessMsg('Verification code requested. Check your email inbox.');
      }
    } catch (err: any) {
      console.error('Password reset request error:', err);
      setAuthError(err?.errors?.[0]?.longMessage || err?.message || 'Could not send reset code. Please check that this email is registered.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetCode.trim()) {
      setAuthError('Please enter the 6-digit verification code.');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setAuthError('New password must be at least 8 characters.');
      return;
    }
    setIsLoading(true);
    setAuthError(null);

    try {
      const targetSignIn = signIn || (clerk as any).client?.signIn;
      if (targetSignIn?.attemptFirstFactor) {
        const result = await targetSignIn.attemptFirstFactor({
          strategy: 'reset_password_email_code',
          code: resetCode.trim(),
          password: newPassword,
        });

        if (result.status === 'complete') {
          if (typeof clerk?.setActive === 'function') {
            await clerk.setActive({ session: result.createdSessionId });
          }
          navigate(targetPath);
          return;
        }
      }
      await login(email.trim(), newPassword);
      navigate(targetPath);
    } catch (err: any) {
      console.error('Password reset completion error:', err);
      setAuthError(err?.errors?.[0]?.longMessage || err?.message || 'Incorrect verification code or password does not meet requirements.');
    } finally {
      setIsLoading(false);
    }
  };

  const GithubIcon = () => (
    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
    </svg>
  );

  const GoogleIcon = () => (
    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );

  // If waiting for external browser completion, show dedicated interactive state
  if (isWaitingForBrowser) {
    const providerName = waitingStrategy === 'oauth_github' ? 'GitHub' : 'Google';
    return (
      <div className="w-full max-w-xl mx-auto">
        <div className="bg-black/60 backdrop-blur-3xl border border-white/10 rounded-[2rem] p-8 sm:p-10 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.8)] relative overflow-hidden text-center">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/10 p-2.5 flex items-center justify-center shadow-xl ring-1 ring-white/10">
              <img 
                src="/logo-tight.png" 
                alt="Bedrock Logo" 
                className="w-full h-full object-contain filter drop-shadow-[0_0_12px_rgba(139,212,186,0.35)] animate-pulse" 
              />
            </div>
          </div>

          <h2 className="text-2xl font-display font-bold text-white tracking-tight">
            Browser Authentication In Progress
          </h2>

          <p className="text-gray-400 mt-2 text-sm leading-relaxed max-w-md mx-auto">
            A new tab has opened in your default web browser to {mode === 'login' ? 'sign in' : 'sign up'} with{' '}
            <span className="text-white font-medium">{providerName}</span>. Please complete authorization in that tab.
          </p>

          <div className="my-8 flex flex-col items-center justify-center gap-3">
            <div className="relative flex items-center justify-center">
              <div className="w-12 h-12 border-3 border-white/10 border-t-emerald-500 rounded-full animate-spin"></div>
              <div className="absolute w-6 h-6 rounded-full bg-emerald-500/20 blur-sm"></div>
            </div>
            <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest">
              Waiting for authorization...
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={reopenBrowserAuth}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-all cursor-pointer"
            >
              Re-open browser tab
            </button>
            <button
              type="button"
              onClick={cancelBrowserAuth}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-zinc-400 hover:text-white text-xs font-medium transition-all cursor-pointer"
            >
              Cancel &amp; use email
            </button>
          </div>

          <p className="mt-8 text-[11px] text-zinc-600 font-mono">
            Bedrock automatically resumes your session once verified in browser
          </p>
        </div>
      </div>
    );
  }

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
              {mode === 'forgot' ? 'Reset password' : mode === 'login' ? 'Welcome back' : 'Create account'}
            </h2>
            <p className="text-gray-400 mt-2 text-sm">
              {mode === 'forgot'
                ? (forgotStep === 'verify' ? `Enter the 6-digit code sent to ${email || 'your email'}` : 'Enter your email to receive a password reset code.')
                : mode === 'login' 
                  ? 'Sign in to access your prompts and workspaces.' 
                  : 'Start building perfect prompts with Bedrock today.'}
            </p>
          </div>

          {mode === 'forgot' ? (
            <form onSubmit={forgotStep === 'request' ? handleForgotPasswordRequest : handleForgotPasswordReset} className="space-y-4">
              {forgotStep === 'request' ? (
                <>
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

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-2 bg-white text-black rounded-xl py-3.5 font-semibold hover:bg-gray-200 transition-all focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-70 mt-4 group cursor-pointer"
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                    ) : (
                      <>
                        Send reset code
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                </>
              ) : (
                <>
                  <div className="relative">
                    <input 
                      type="text" 
                      placeholder="6-digit reset code" 
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value)}
                      required
                      maxLength={8}
                      className="w-full bg-transparent border border-white/10 rounded-xl py-3 px-4 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-copper-500/50 font-mono tracking-widest text-center text-lg transition-all"
                    />
                  </div>

                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input 
                      type="password" 
                      placeholder="New password (min 8 chars)" 
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      className="w-full bg-transparent border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-copper-500/50 transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-2 bg-white text-black rounded-xl py-3.5 font-semibold hover:bg-gray-200 transition-all focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-70 mt-4 group cursor-pointer"
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                    ) : (
                      <>
                        Reset password & sign in
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                </>
              )}

              {successMsg && (
                <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs text-center leading-relaxed">
                  {successMsg}
                </div>
              )}

              {authError && (
                <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center leading-relaxed">
                  {authError}
                </div>
              )}

              <div className="pt-3 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setForgotStep('request');
                    setAuthError(null);
                    setSuccessMsg(null);
                  }}
                  className="text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                  &larr; Back to sign in
                </button>

                {forgotStep === 'verify' && (
                  <button
                    type="button"
                    onClick={handleForgotPasswordRequest}
                    disabled={isLoading}
                    className="text-copper-400 hover:text-copper-300 transition-colors cursor-pointer"
                  >
                    Resend code
                  </button>
                )}
              </div>
            </form>
          ) : (
            <>
              {/* PRIMARY HERO OAUTH BUTTONS: First thing user sees on launch */}
              <div className="space-y-3 mb-6">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-3 bg-white text-black hover:bg-zinc-200 rounded-xl py-3.5 font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-white/40 shadow-lg shadow-black/40 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  <GoogleIcon />
                  <span>{mode === 'login' ? 'Sign in with Google' : 'Sign up with Google'}</span>
                  <ArrowRight className="w-4 h-4 ml-auto text-black/60 group-hover:translate-x-1 transition-transform" />
                </button>

                <button
                  type="button"
                  onClick={handleGithubSignIn}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-3 bg-zinc-900 border border-white/15 hover:bg-zinc-800 text-white rounded-xl py-3.5 font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-white/20 shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  <GithubIcon />
                  <span>{mode === 'login' ? 'Sign in with GitHub' : 'Sign up with GitHub'}</span>
                  <ArrowRight className="w-4 h-4 ml-auto text-white/50 group-hover:translate-x-1 transition-transform" />
                </button>

                <div className="text-center pt-1">
                  <span className="text-[11px] text-zinc-500 font-mono tracking-tight">
                    {isDesktop ? 'Opens secure authentication in your system browser tab' : 'Prompts account selection & consent verification'}
                  </span>
                </div>
              </div>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-4 bg-[#0a0a0a] text-zinc-400 uppercase tracking-wider font-mono">
                    Or continue with email
                  </span>
                </div>
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
                    <button 
                      type="button" 
                      onClick={() => {
                        setMode('forgot');
                        setForgotStep('request');
                        setAuthError(null);
                        setSuccessMsg(null);
                      }}
                      className="text-sm font-medium text-copper-400 hover:text-copper-300 transition-colors cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 bg-white/10 border border-white/15 text-white rounded-xl py-3.5 font-semibold hover:bg-white/20 transition-all focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-70 mt-4 group cursor-pointer"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      {mode === 'login' ? 'Sign in with Email' : 'Create account with Email'}
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </form>

              {authError && (
                <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center leading-relaxed">
                  {authError}
                </div>
              )}

              <div className="mt-8 text-center text-sm text-gray-400">
                {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
                <button 
                  type="button"
                  onClick={() => {
                    setAuthError(null);
                    setMode(mode === 'login' ? 'register' : 'login');
                  }}
                  className="font-semibold text-copper-400 hover:text-copper-300 transition-colors cursor-pointer"
                >
                  {mode === 'login' ? 'Sign up' : 'Sign in'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
