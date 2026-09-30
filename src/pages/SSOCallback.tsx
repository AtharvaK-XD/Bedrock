import { useEffect } from 'react';
import { AuthenticateWithRedirectCallback, useAuth } from '@clerk/react';
import { PageTransition } from '../components/layout/PageTransition';

export default function SSOCallback() {
  const { isSignedIn } = useAuth();

  useEffect(() => {
    const notifyAndClose = () => {
      try {
        localStorage.setItem('bedrock_auth_event', Date.now().toString());
      } catch {
        // ignore
      }

      if (window.opener) {
        try {
          window.opener.postMessage('clerk-auth-complete', '*');
        } catch {
          // ignore cross-origin if any
        }
        setTimeout(() => {
          try {
            window.close();
          } catch {
            // ignore
          }
        }, 150);
      }
    };

    if (isSignedIn) {
      notifyAndClose();
    }

    // In case session becomes active before hook triggers
    const interval = setInterval(() => {
      const hasSession = Boolean(
        (window as any).Clerk?.session || 
        (window as any).Clerk?.user
      );
      if (hasSession) {
        clearInterval(interval);
        notifyAndClose();
      }
    }, 200);

    return () => clearInterval(interval);
  }, [isSignedIn]);

  return (
    <PageTransition className="flex items-center justify-center min-h-screen bg-[#050505]">
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 border-2 border-white/20 border-t-copper-500 rounded-full animate-spin"></div>
        <p className="text-gray-400 font-medium text-sm">Authenticating...</p>
        <AuthenticateWithRedirectCallback
          signInFallbackRedirectUrl="/app"
          signUpFallbackRedirectUrl="/app"
          signInForceRedirectUrl="/app"
          signUpForceRedirectUrl="/app"
        />
      </div>
    </PageTransition>
  );
}
