import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useClerk } from '@clerk/react';
import { useSignIn, useSignUp } from '@clerk/react/legacy';
import { PageTransition } from '../components/layout/PageTransition';

export default function BrowserAuth() {
  const [searchParams] = useSearchParams();
  const clerk = useClerk();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();

  const strategy = (searchParams.get('strategy') as 'oauth_google' | 'oauth_github') || 'oauth_google';
  const mode = searchParams.get('mode') || 'register';
  const nonce = searchParams.get('nonce') || '';
  const port = searchParams.get('port') || '0';

  const [status, setStatus] = useState<'initializing' | 'redirecting' | 'error'>('initializing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const attemptedRef = useRef(false);

  const providerName = strategy === 'oauth_github' ? 'GitHub' : 'Google';

  const executeAuth = async () => {
    try {
      setStatus('redirecting');
      setErrorMessage(null);

      // Sign out any old session in browser so user is prompted to pick account fresh
      if (clerk && (clerk.session || clerk.user || (window as any).Clerk?.session)) {
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
      const authResource = mode === 'register' ? (targetSignUp || targetSignIn) : (targetSignIn || targetSignUp);

      const callbackUrl = `${window.location.origin}/#/browser-auth-callback?nonce=${encodeURIComponent(nonce)}&port=${encodeURIComponent(port)}&strategy=${encodeURIComponent(strategy)}`;

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
      setErrorMessage(err?.message || `Failed to initiate ${providerName} sign-up.`);
    }
  };

  useEffect(() => {
    if (attemptedRef.current) return;

    if (clerk.loaded) {
      attemptedRef.current = true;
      executeAuth();
    }
  }, [clerk.loaded]);

  return (
    <PageTransition className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Ambient Copper/Emerald Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-copper-500/10 blur-[180px] pointer-events-none rounded-full" />
      
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-zinc-950/80 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 sm:p-10 shadow-2xl text-center">
          
          {/* Logo Badge */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/10 p-2.5 flex items-center justify-center shadow-xl ring-1 ring-white/10">
              <img 
                src="/logo-tight.png" 
                alt="Bedrock Logo" 
                className="w-full h-full object-contain filter drop-shadow-[0_0_12px_rgba(139,212,186,0.35)]" 
              />
            </div>
          </div>

          <h2 className="text-2xl font-display font-bold text-white tracking-tight">
            Bedrock Desktop Authentication
          </h2>
          
          <p className="text-zinc-400 mt-2 text-sm leading-relaxed">
            {status === 'error'
              ? 'There was an issue opening the authorization window.'
              : `Opening ${providerName} secure sign-up for your Bedrock desktop application.`}
          </p>

          <div className="my-8 flex flex-col items-center justify-center gap-4">
            {status !== 'error' ? (
              <>
                <div className="relative flex items-center justify-center">
                  <div className="w-12 h-12 border-3 border-white/10 border-t-emerald-500 rounded-full animate-spin"></div>
                  <div className="absolute w-6 h-6 rounded-full bg-emerald-500/20 blur-sm"></div>
                </div>
                <span className="text-xs font-mono text-zinc-500 tracking-wider uppercase">
                  Connecting to {providerName}...
                </span>
              </>
            ) : (
              <div className="w-full p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-left">
                {errorMessage}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={executeAuth}
            className="w-full flex items-center justify-center gap-2 bg-white text-black rounded-xl py-3.5 font-semibold hover:bg-zinc-200 transition-all focus:outline-none focus:ring-2 focus:ring-white/50 cursor-pointer text-sm shadow-md"
          >
            {status === 'error' ? 'Retry Connection' : `Continue with ${providerName}`}
          </button>

          <p className="mt-6 text-[11px] text-zinc-500 font-mono">
            Direct browser single sign-on &bull; Port {port || 'Local'}
          </p>
        </div>
      </div>
    </PageTransition>
  );
}
