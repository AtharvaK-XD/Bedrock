import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useClerk } from '@clerk/react';
import { useSignIn, useSignUp } from '@clerk/react/legacy';

export default function PopupAuth() {
  const [searchParams] = useSearchParams();
  const clerk = useClerk();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();

  const strategy = (searchParams.get('strategy') as 'oauth_google' | 'oauth_github') || 'oauth_google';
  const mode = searchParams.get('mode') || 'login';

  const [status, setStatus] = useState<'redirecting' | 'error'>('redirecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const attemptedRef = useRef(false);

  const providerName = strategy === 'oauth_github' ? 'GitHub' : 'Google';

  const executeAuth = useCallback(async () => {
    try {
      setStatus('redirecting');
      setErrorMessage(null);

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
      const authResource = mode === 'register' ? (targetSignUp || targetSignIn) : (targetSignIn || targetSignUp);

      const origin = (typeof window !== 'undefined' && window.location.origin && !window.location.origin.startsWith('file'))
        ? window.location.origin
        : 'https://bedrock-steel.vercel.app';
      const callbackUrl = `${origin}/sso-callback`;
      const targetUrl = `${origin}/app`;

      // Direct redirection to Google / GitHub native consent screen
      if (typeof authResource?.authenticateWithRedirect === 'function') {
        await authResource.authenticateWithRedirect({
          strategy,
          redirectUrl: callbackUrl,
          redirectUrlComplete: targetUrl,
          oidcPrompt: 'select_account consent',
        });
        return;
      }

      const fallbackResource = authResource === targetSignIn ? targetSignUp : targetSignIn;
      if (typeof fallbackResource?.authenticateWithRedirect === 'function') {
        await fallbackResource.authenticateWithRedirect({
          strategy,
          redirectUrl: callbackUrl,
          redirectUrlComplete: targetUrl,
          oidcPrompt: 'select_account consent',
        });
        return;
      }

      throw new Error(`Failed to initialize ${providerName} authentication redirect.`);
    } catch (err: any) {
      console.error('PopupAuth error:', err);
      setStatus('error');
      setErrorMessage(err?.message || `Failed to connect with ${providerName}.`);
    }
  }, [clerk, signIn, signUp, strategy, mode, providerName]);

  useEffect(() => {
    let timer: any = null;

    const tryLaunch = () => {
      if (attemptedRef.current) return;

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
      const authResource = mode === 'register' ? (targetSignUp || targetSignIn) : (targetSignIn || targetSignUp);

      if (typeof authResource?.authenticateWithRedirect === 'function') {
        attemptedRef.current = true;
        if (timer) clearInterval(timer);
        executeAuth();
      }
    };

    tryLaunch();

    if (typeof (clerk as any)?.addOnLoaded === 'function') {
      (clerk as any).addOnLoaded(tryLaunch);
    }

    timer = setInterval(tryLaunch, 25);

    const fallbackTimer = setTimeout(() => {
      if (!attemptedRef.current) {
        attemptedRef.current = true;
        if (timer) clearInterval(timer);
        executeAuth();
      }
    }, 1200);

    return () => {
      if (timer) clearInterval(timer);
      clearTimeout(fallbackTimer);
    };
  }, [clerk, signIn, signUp, mode, executeAuth]);

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-zinc-950 border border-white/10 rounded-2xl p-6 text-center space-y-4">
          <p className="text-sm text-red-400">{errorMessage}</p>
          <button
            type="button"
            onClick={executeAuth}
            className="w-full bg-white text-black py-2.5 rounded-xl font-semibold text-xs hover:bg-zinc-200 transition-all cursor-pointer"
          >
            Retry Connection with {providerName}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center font-sans select-none">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-white/10 border-t-copper-500 rounded-full animate-spin" />
        <span className="text-xs font-mono text-zinc-500 tracking-wider">
          Connecting to {providerName}...
        </span>
      </div>
    </div>
  );
}
