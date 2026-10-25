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

  const completeAlreadySignedIn = useCallback(() => {
    try {
      const activeClerk = clerk || (typeof window !== 'undefined' ? (window as any).Clerk : null);
      const user = activeClerk?.user || (clerk as any)?.user;
      const email = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || 'developer@bedrock.app';
      const name = user?.fullName || user?.firstName || email.split('@')[0];
      const now = Date.now();

      localStorage.setItem('bedrock_auth_session', JSON.stringify({
        isLoggedIn: true,
        email,
        name,
        loginTime: new Date().toISOString(),
        lastActiveAt: now,
      }));
      localStorage.setItem('bedrock_auth_event', now.toString());
      try {
        window.sessionStorage?.removeItem('bedrock_auth_popup');
      } catch {}
      window.dispatchEvent(new Event('bedrock_auth_update'));
    } catch {}

    if (typeof window !== 'undefined' && window.opener) {
      try {
        window.opener.postMessage('clerk-auth-complete', '*');
      } catch {}
    }

    try {
      window.close();
    } catch {}
    setTimeout(() => {
      try { window.close(); } catch {}
    }, 100);
    setTimeout(() => {
      if (typeof window !== 'undefined' && !window.closed) {
        window.location.replace('/app');
      }
    }, 400);
  }, [clerk]);

  const executeAuth = useCallback(async () => {
    try {
      setStatus('redirecting');
      setErrorMessage(null);

      if (typeof window !== 'undefined') {
        window.name = 'BedrockOAuth';
        try {
          window.sessionStorage.setItem('bedrock_auth_popup', '1');
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

      // Check if user is already signed in with Clerk
      const isAlreadyAuthed = Boolean(
        (clerk as any)?.session ||
        (clerk as any)?.user ||
        (window as any).Clerk?.session ||
        (window as any).Clerk?.user ||
        client?.session
      );
      if (isAlreadyAuthed) {
        completeAlreadySignedIn();
        return;
      }

      const targetSignIn = signIn || client?.signIn || (clerk as any).client?.signIn;
      const targetSignUp = signUp || client?.signUp || (clerk as any).client?.signUp;
      const authResource = mode === 'register' ? (targetSignUp || targetSignIn) : (targetSignIn || targetSignUp);

      const origin = (typeof window !== 'undefined' && window.location.origin && !window.location.origin.startsWith('file'))
        ? window.location.origin
        : 'https://bedrock-steel.vercel.app';
      const callbackUrl = `${origin}/sso-callback?popup=1`;
      const targetUrl = `${origin}/sso-callback?popup=1`;

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
      const isAlreadySignedIn = 
        err?.errors?.[0]?.message?.toLowerCase().includes('already signed in') ||
        err?.message?.toLowerCase().includes('already signed in');

      if (isAlreadySignedIn) {
        completeAlreadySignedIn();
        return;
      }

      setStatus('error');
      setErrorMessage(err?.message || `Failed to connect with ${providerName}.`);
    }
  }, [clerk, signIn, signUp, strategy, mode, providerName, completeAlreadySignedIn]);

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

      // Pre-check for existing session
      const isAlreadyAuthed = Boolean(
        (clerk as any)?.session ||
        (clerk as any)?.user ||
        (window as any).Clerk?.session ||
        (window as any).Clerk?.user ||
        client?.session
      );
      if (isAlreadyAuthed) {
        attemptedRef.current = true;
        if (timer) clearInterval(timer);
        completeAlreadySignedIn();
        return;
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
  }, [clerk, signIn, signUp, mode, executeAuth, completeAlreadySignedIn]);

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
