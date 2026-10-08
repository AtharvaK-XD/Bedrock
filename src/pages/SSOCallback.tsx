import { useEffect, useRef } from 'react';
import { AuthenticateWithRedirectCallback, useAuth, useClerk, useUser } from '@clerk/react';
import { useNavigate } from 'react-router-dom';
import { PageTransition } from '../components/layout/PageTransition';

export default function SSOCallback() {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const clerk = useClerk();
  const navigate = useNavigate();
  const completedRef = useRef(false);

  useEffect(() => {
    const notifyAndComplete = () => {
      if (completedRef.current) return;
      completedRef.current = true;

      try {
        const clerkUser = user || (window as any).Clerk?.user || (clerk as any)?.user;
        const email = clerkUser?.primaryEmailAddress?.emailAddress || clerkUser?.emailAddresses?.[0]?.emailAddress || 'developer@bedrock.app';
        const name = clerkUser?.fullName || clerkUser?.firstName || email.split('@')[0];
        
        localStorage.setItem('bedrock_auth_session', JSON.stringify({
          isLoggedIn: true,
          email,
          name,
          loginTime: new Date().toISOString()
        }));
        localStorage.setItem('bedrock_auth_event', Date.now().toString());
        window.dispatchEvent(new Event('bedrock_auth_update'));
      } catch {
        // ignore
      }

      if (window.opener) {
        try {
          window.opener.postMessage('clerk-auth-complete', '*');
        } catch {
          // ignore
        }
        setTimeout(() => {
          try {
            window.close();
          } catch {
            // ignore
          }
        }, 200);
      } else {
        navigate('/app', { replace: true });
      }
    };

    if (isSignedIn) {
      notifyAndComplete();
    }

    // In case session becomes active before hook triggers
    const interval = setInterval(() => {
      const hasSession = Boolean(
        (window as any).Clerk?.session || 
        (window as any).Clerk?.user ||
        clerk?.session ||
        clerk?.user
      );
      if (hasSession) {
        clearInterval(interval);
        notifyAndComplete();
      }
    }, 150);

    return () => clearInterval(interval);
  }, [isSignedIn, user, clerk, navigate]);

  return (
    <PageTransition className="flex items-center justify-center min-h-screen bg-[#050505]">
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 border-2 border-white/20 border-t-copper-500 rounded-full animate-spin"></div>
        <p className="text-gray-400 font-medium text-sm">Completing authentication...</p>
        <AuthenticateWithRedirectCallback
          signInFallbackRedirectUrl="/app"
          signUpFallbackRedirectUrl="/app"
          signInForceRedirectUrl="/app"
          signUpForceRedirectUrl="/app"
          continueSignUpUrl="/signup"
        />
      </div>
    </PageTransition>
  );
}
