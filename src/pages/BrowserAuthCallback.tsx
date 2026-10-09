import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AuthenticateWithRedirectCallback, useUser, useClerk } from '@clerk/react';
import { Check, ExternalLink, ArrowRight } from 'lucide-react';
import { resolveCleanName } from '../lib/useUserProfile';
import { PageTransition } from '../components/layout/PageTransition';

export default function BrowserAuthCallback() {
  const [searchParams] = useSearchParams();
  const { user, isLoaded, isSignedIn } = useUser();
  const clerk = useClerk();

  const nonce = searchParams.get('nonce') || '';
  const port = searchParams.get('port') || '0';
  const strategy = searchParams.get('strategy') || 'oauth_google';

  const [handshakeComplete, setHandshakeComplete] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const sentRef = useRef(false);

  const deepLinkPayload = useRef<any>(null);

  useEffect(() => {
    if (sentRef.current) return;

    const notifyDesktop = async (currentUser: any) => {
      sentRef.current = true;
      const cleanEmail = currentUser.primaryEmailAddress?.emailAddress || currentUser.emailAddresses?.[0]?.emailAddress || 'developer@bedrock.app';
      const cleanName = resolveCleanName(currentUser.fullName || currentUser.firstName, cleanEmail);
      const avatarUrl = currentUser.imageUrl || '';

      const payload = {
        nonce,
        email: cleanEmail,
        name: cleanName,
        avatarUrl,
        clerkUserId: currentUser.id,
        strategy,
        timestamp: Date.now(),
      };

      deepLinkPayload.current = payload;

      // 1. Post to local loopback server on 127.0.0.1
      if (port && port !== '0') {
        try {
          await fetch(`http://127.0.0.1:${port}/api/desktop-auth-complete`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });
        } catch (fetchErr) {
          console.warn('[BrowserAuth] Direct HTTP callback to 127.0.0.1 failed, falling back to protocol:', fetchErr);
        }
      }

      // 2. Trigger bedrock:// protocol URL
      try {
        const protocolUrl = `bedrock://auth-complete?data=${encodeURIComponent(JSON.stringify(payload))}`;
        window.location.href = protocolUrl;
      } catch (protocolErr) {
        console.warn('[BrowserAuth] Protocol deep link trigger error:', protocolErr);
      }

      setHandshakeComplete(true);
    };

    if (isLoaded && isSignedIn && user) {
      notifyDesktop(user);
    } else {
      // In case user object is available directly on window.Clerk
      const clerkUser = (clerk as any)?.user || (window as any).Clerk?.user;
      if (clerkUser) {
        notifyDesktop(clerkUser);
      }
    }
  }, [isLoaded, isSignedIn, user, clerk, nonce, port, strategy]);

  useEffect(() => {
    if (!handshakeComplete) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          try {
            window.close();
          } catch {
            // Browsers may prevent script-closing tabs not opened by script
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [handshakeComplete]);

  const handleManualOpenApp = () => {
    if (deepLinkPayload.current) {
      const protocolUrl = `bedrock://auth-complete?data=${encodeURIComponent(JSON.stringify(deepLinkPayload.current))}`;
      window.location.href = protocolUrl;
    } else {
      window.location.href = 'bedrock://';
    }
  };

  return (
    <PageTransition className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-emerald-500/10 blur-[180px] pointer-events-none rounded-full" />

      {/* Invisible Clerk redirect callback handler to complete token handshake */}
      <div className="hidden">
        <AuthenticateWithRedirectCallback
          signInFallbackRedirectUrl="/browser-auth-callback"
          signUpFallbackRedirectUrl="/browser-auth-callback"
        />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="bg-zinc-950/80 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 sm:p-10 shadow-2xl text-center">
          
          {handshakeComplete ? (
            <>
              {/* Animated Success Badge */}
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-500/10">
                  <Check className="w-8 h-8" />
                </div>
              </div>

              <h2 className="text-2xl font-display font-bold text-white tracking-tight">
                Authentication Complete
              </h2>

              <p className="text-zinc-400 mt-2 text-sm leading-relaxed">
                Welcome, <span className="text-white font-medium">{user?.fullName || user?.firstName || 'Developer'}</span>! Your Bedrock desktop app has been authenticated.
              </p>

              <div className="mt-8 space-y-3">
                <button
                  type="button"
                  onClick={handleManualOpenApp}
                  className="w-full flex items-center justify-center gap-2 bg-[#2C9A8B] text-white rounded-xl py-3.5 font-semibold hover:bg-[#1F7A6E] transition-all focus:outline-none focus:ring-2 focus:ring-copper-400/50 cursor-pointer text-sm shadow-lg shadow-[#2C9A8B]/25 active:scale-[0.98]"
                >
                  <ExternalLink className="w-4 h-4" />
                  Return to Bedrock Desktop
                </button>

                <p className="text-[12px] text-zinc-500 pt-2 font-mono">
                  You can safely close this tab {countdown > 0 ? `(auto-close in ${countdown}s)` : ''}
                </p>
              </div>
            </>
          ) : (
            <>
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
                Finalizing Authentication...
              </h2>

              <p className="text-zinc-400 mt-2 text-sm">
                Confirming authorization with Bedrock Desktop...
              </p>

              <div className="my-8 flex justify-center">
                <div className="w-10 h-10 border-3 border-white/10 border-t-emerald-500 rounded-full animate-spin"></div>
              </div>

              <button
                type="button"
                onClick={handleManualOpenApp}
                className="w-full flex items-center justify-center gap-2 bg-white/10 text-white rounded-xl py-3 text-xs hover:bg-white/20 transition-all"
              >
                Return to app now
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          <div className="mt-8 border-t border-white/5 pt-4">
            <span className="text-[11px] text-zinc-600 font-mono">
              Bedrock Native SSO &bull; Verified
            </span>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
