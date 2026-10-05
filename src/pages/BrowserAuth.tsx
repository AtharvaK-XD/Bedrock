import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useClerk } from '@clerk/react';
import { useSignIn, useSignUp } from '@clerk/react/legacy';

export default function BrowserAuth() {
  const [searchParams] = useSearchParams();
  const clerk = useClerk();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();

  const strategy = (searchParams.get('strategy') as 'oauth_google' | 'oauth_github') || 'oauth_google';
  const mode = searchParams.get('mode') || 'login';
  const nonce = searchParams.get('nonce') || '';
  const port = searchParams.get('port') || '0';

  const [status, setStatus] = useState<'initializing' | 'redirecting' | 'error'>('initializing');
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

      const callbackUrl = `${window.location.origin}/#/browser-auth-callback?nonce=${encodeURIComponent(nonce)}&port=${encodeURIComponent(port)}&strategy=${encodeURIComponent(strategy)}`;

      // Immediate redirect to Google / GitHub consent screen
      if (typeof authResource?.authenticateWithRedirect === 'function') {
        await authResource.authenticateWithRedirect({
          strategy,
          redirectUrl: callbackUrl,
          redirectUrlComplete: callbackUrl,
          oidcPrompt: 'select_account consent',
        });
        return;
      }

      if (typeof clerk.redirectToSignIn === 'function') {
        await clerk.redirectToSignIn({
          signInFallbackRedirectUrl: callbackUrl,
          signInForceRedirectUrl: callbackUrl,
        });
        return;
      }

      throw new Error('Authentication client failed to initialize redirect.');
    } catch (err: any) {
      console.error('BrowserAuth execution error:', err);
      setStatus('error');
      setErrorMessage(err?.message || `Failed to initiate ${providerName} sign-in.`);
    }
  }, [clerk, signIn, signUp, strategy, mode, nonce, port, providerName]);

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

      const hasAuthRedirect = typeof authResource?.authenticateWithRedirect === 'function';
      const hasClerkRedirect = typeof clerk?.redirectToSignIn === 'function' || typeof (window as any).Clerk?.redirectToSignIn === 'function';

      if (hasAuthRedirect || hasClerkRedirect) {
        attemptedRef.current = true;
        if (timer) clearInterval(timer);
        executeAuth();
      }
    };

    // 1. Check immediately
    tryLaunch();

    // 2. Attach Clerk event listener if available
    if (typeof (clerk as any)?.addOnLoaded === 'function') {
      (clerk as any).addOnLoaded(() => {
        tryLaunch();
      });
    }

    // 3. High-frequency timer check (every 25ms) so redirect occurs instantly
    timer = setInterval(tryLaunch, 25);

    // 4. Force attempt after 1500ms even if condition not satisfied yet
    const fallbackTimer = setTimeout(() => {
      if (!attemptedRef.current) {
        attemptedRef.current = true;
        if (timer) clearInterval(timer);
        executeAuth();
      }
    }, 1500);

    return () => {
      if (timer) clearInterval(timer);
      clearTimeout(fallbackTimer);
    };
  }, [clerk, signIn, signUp, mode, executeAuth]);

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-zinc-950 border border-white/10 rounded-3xl p-8 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mx-auto text-lg font-bold">
            !
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Authorization Needed</h2>
          <p className="text-xs text-zinc-400 leading-relaxed">{errorMessage}</p>
          <button
            type="button"
            onClick={executeAuth}
            className="w-full bg-white text-black py-3.5 rounded-xl font-semibold text-sm hover:bg-zinc-200 transition-all cursor-pointer shadow-md"
          >
            Retry Connection with {providerName}
          </button>
        </div>
      </div>
    );
  }

  // Instant seamless redirector screen without intermediate cards
  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center font-sans select-none">
      <div className="flex flex-col items-center gap-4">
        <div className="w-9 h-9 border-2 border-white/10 border-t-emerald-400 rounded-full animate-spin" />
        <span className="text-xs font-mono text-zinc-500 tracking-wider">
          Redirecting to {providerName}...
        </span>
      </div>
    </div>
  );
}
