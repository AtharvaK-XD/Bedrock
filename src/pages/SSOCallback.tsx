import { useEffect } from 'react';
import { AuthenticateWithRedirectCallback, useAuth } from '@clerk/react';
import { PageTransition } from '../components/layout/PageTransition';

export default function SSOCallback() {
  const { isSignedIn } = useAuth();

  useEffect(() => {
    if (isSignedIn && window.opener) {
      try {
        window.opener.postMessage('clerk-auth-complete', '*');
      } catch {
        // ignore cross-origin if any
      }
      setTimeout(() => {
        window.close();
      }, 200);
    }
  }, [isSignedIn]);

  return (
    <PageTransition className="flex items-center justify-center min-h-screen bg-[#050505]">
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 border-2 border-white/20 border-t-copper-500 rounded-full animate-spin"></div>
        <p className="text-gray-400 font-medium text-sm">Authenticating...</p>
        <AuthenticateWithRedirectCallback />
      </div>
    </PageTransition>
  );
}
