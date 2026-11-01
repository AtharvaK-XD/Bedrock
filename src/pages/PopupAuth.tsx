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

      const targetSignIn = client?.signIn || signIn || (clerk as any).client?.signIn;
      const targetSignUp = client?.signUp || signUp || (clerk as any).client?.signUp;
      const authResource = mode === 'register' ? (targetSignUp || targetSignIn) : (targetSignIn || targetSignUp);

      if (typeof authResource?.authenticateWithRedirect !== 'function') {
        throw new Error(`Authentication provider is still initializing. Please wait...`);
      }

      const origin = (typeof window !== 'undefined' && window.location.origin && !window.location.origin.startsWith('file'))
        ? window.location.origin
        : 'https://bedrock-steel.vercel.app';
      const callbackUrl = `${origin}/sso-callback?popup=1`;
      const targetUrl = `${origin}/sso-callback?popup=1`;

      const redirectParams: any = {
        strategy,
        redirectUrl: callbackUrl,
        redirectUrlComplete: targetUrl,
      };

      // Only pass oidcPrompt for OpenID Connect providers (Google)
      if (strategy === 'oauth_google') {
        redirectParams.oidcPrompt = 'select_account';
      }

      await authResource.authenticateWithRedirect(redirectParams);
    } catch (err: any) {
      console.error('PopupAuth error:', err);
      const isAlreadySignedIn = 
        err?.errors?.[0]?.message?.toLowerCase().includes('already signed in') ||
        err?.message?.toLowerCase().includes('already signed in');

      // If user is already authenticated with Clerk, notify opener and close popup
      if (isAlreadySignedIn) {
        try {
          if (typeof window !== 'undefined' && window.opener) {
            window.opener.postMessage('clerk-auth-complete', '*');
          }
          if (typeof window !== 'undefined') {
            window.close();
          }
        } catch {
          // ignore
        }
        return;
      }

      attemptedRef.current = false;
      setStatus('error');
      setErrorMessage(err?.message || `Failed to connect with ${providerName}.`);
    }
  }, [clerk, signIn, signUp, strategy, mode, providerName]);

  useEffect(() => {
    let timer: any = null;
    let timeoutTimer: any = null;
    let attempts = 0;
    const maxAttempts = 120; // 6 seconds at 50ms intervals

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

      const targetSignIn = client?.signIn || signIn || (clerk as any).client?.signIn;
      const targetSignUp = client?.signUp || signUp || (clerk as any).client?.signUp;
      const authResource = mode === 'register' ? (targetSignUp || targetSignIn) : (targetSignIn || targetSignUp);

      if (typeof authResource?.authenticateWithRedirect === 'function') {
        attemptedRef.current = true;
        if (timer) clearInterval(timer);
        if (timeoutTimer) clearTimeout(timeoutTimer);
        executeAuth();
        return;
      }

      attempts++;
      if (attempts >= maxAttempts) {
        if (timer) clearInterval(timer);
        if (timeoutTimer) clearTimeout(timeoutTimer);
        if (!attemptedRef.current) {
          attemptedRef.current = true;
          executeAuth();
        }
      }
    };

    tryLaunch();

    if (typeof (clerk as any)?.addOnLoaded === 'function') {
      (clerk as any).addOnLoaded(tryLaunch);
    }

    timer = setInterval(tryLaunch, 50);

    timeoutTimer = setTimeout(() => {
      if (!attemptedRef.current) {
        attemptedRef.current = true;
        if (timer) clearInterval(timer);
        executeAuth();
      }
    }, 6000);

    return () => {
      if (timer) clearInterval(timer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
    };
  }, [clerk, signIn, signUp, mode, executeAuth]);

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-sf-050505 text-white flex flex-col items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-zinc-950 border border-white/10 rounded-2xl p-6 text-center space-y-4">
          <p className="text-sm text-red-400">{errorMessage}</p>
          <button
            type="button"
            onClick={() => {
              attemptedRef.current = false;
              executeAuth();
            }}
            className="w-full bg-white text-black py-2.5 rounded-xl font-semibold text-xs hover:bg-zinc-200 transition-all cursor-pointer"
          >
            Retry Connection with {providerName}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sf-050505 text-white flex flex-col items-center justify-center font-sans select-none">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-white/10 border-t-copper-500 rounded-full animate-spin" />
        <span className="text-xs font-mono text-zinc-500 tracking-wider">
          Connecting to {providerName}...
        </span>
      </div>
    </div>
  );
}
