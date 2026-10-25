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

      // Ensure any lingering session is cleanly signed out so the OAuth provider
      // presents the fresh account chooser and consent screen
      const hasLingeringSession = Boolean(
        (clerk as any)?.session ||
        (clerk as any)?.user ||
        (window as any).Clerk?.session ||
        (window as any).Clerk?.user ||
        client?.session
      );
      if (hasLingeringSession) {
        try {
          if (typeof clerk?.signOut === 'function') {
            await clerk.signOut();
          } else if (typeof (window as any).Clerk?.signOut === 'function') {
            await (window as any).Clerk.signOut();
          }
        } catch (signOutErr) {
          console.warn('PopupAuth pre-signout notice:', signOutErr);
        }
      }

      const targetSignIn = client?.signIn || signIn || (clerk as any).client?.signIn;
      const targetSignUp = client?.signUp || signUp || (clerk as any).client?.signUp;
      const authResource = mode === 'register' ? (targetSignUp || targetSignIn) : (targetSignIn || targetSignUp);

      const origin = (typeof window !== 'undefined' && window.location.origin && !window.location.origin.startsWith('file'))
        ? window.location.origin
        : 'https://bedrock-steel.vercel.app';
      const callbackUrl = `${origin}/sso-callback?popup=1`;
      const targetUrl = `${origin}/sso-callback?popup=1`;

      // Redirect to Google / GitHub with explicit account selection & consent prompt
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

      // If Clerk rejected because of an existing session, sign out and retry immediately
      if (isAlreadySignedIn) {
        try {
          if (typeof clerk?.signOut === 'function') {
            await clerk.signOut();
          } else if (typeof (window as any).Clerk?.signOut === 'function') {
            await (window as any).Clerk.signOut();
          }
          let retryClient = (clerk as any)?.client || (window as any).Clerk?.client;
          const retrySignIn = retryClient?.signIn || signIn;
          const retrySignUp = retryClient?.signUp || signUp;
          const retryResource = mode === 'register' ? (retrySignUp || retrySignIn) : (retrySignIn || retrySignUp);

          const origin = (typeof window !== 'undefined' && window.location.origin && !window.location.origin.startsWith('file'))
            ? window.location.origin
            : 'https://bedrock-steel.vercel.app';
          const callbackUrl = `${origin}/sso-callback?popup=1`;

          if (typeof retryResource?.authenticateWithRedirect === 'function') {
            await retryResource.authenticateWithRedirect({
              strategy,
              redirectUrl: callbackUrl,
              redirectUrlComplete: callbackUrl,
              oidcPrompt: 'select_account consent',
            });
            return;
          }
        } catch (retryErr) {
          console.error('Retry after signout error:', retryErr);
        }
      }

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

      const targetSignIn = client?.signIn || signIn || (clerk as any).client?.signIn;
      const targetSignUp = client?.signUp || signUp || (clerk as any).client?.signUp;
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
