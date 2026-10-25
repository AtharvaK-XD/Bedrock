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

  const isPopup = 
    (typeof window !== 'undefined' && window.name === 'BedrockOAuth') ||
    (typeof window !== 'undefined' && window.sessionStorage?.getItem('bedrock_auth_popup') === '1') ||
    (typeof window !== 'undefined' && window.opener !== null) ||
    new URLSearchParams(window.location.search).get('popup') === '1' ||
    (typeof window !== 'undefined' && window.outerWidth > 0 && window.outerWidth < 700);

  useEffect(() => {
    const notifyAndComplete = () => {
      if (completedRef.current) return;
      completedRef.current = true;

      try {
        const clerkUser = user || (window as any).Clerk?.user || (clerk as any)?.user;
        const email = clerkUser?.primaryEmailAddress?.emailAddress || clerkUser?.emailAddresses?.[0]?.emailAddress || 'developer@bedrock.app';
        const name = clerkUser?.fullName || clerkUser?.firstName || email.split('@')[0];
        
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
        } catch {
          // ignore
        }
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
      }

      if (isPopup) {
        try {
          window.close();
        } catch {
          // ignore
        }
        setTimeout(() => {
          try {
            window.close();
          } catch {
            // ignore
          }
        }, 50);
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

    // Clerk event listener for instant response
    let unsubscribeClerk: (() => void) | undefined;
    try {
      if (typeof (clerk as any)?.addListener === 'function') {
        unsubscribeClerk = (clerk as any).addListener((emission: any) => {
          if (emission?.session || emission?.user) {
            notifyAndComplete();
          }
        });
      }
    } catch {
      // ignore
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
    }, 100);

    return () => {
      clearInterval(interval);
      if (unsubscribeClerk) unsubscribeClerk();
    };
  }, [isSignedIn, user, clerk, navigate, isPopup]);

  return (
    <PageTransition className="flex items-center justify-center min-h-screen bg-[#050505]">
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 border-2 border-white/20 border-t-copper-500 rounded-full animate-spin"></div>
        <p className="text-gray-400 font-medium text-sm">
          {isPopup ? 'Authentication complete! Closing window...' : 'Completing authentication...'}
        </p>
        <AuthenticateWithRedirectCallback
          signInFallbackRedirectUrl={isPopup ? '/sso-callback?popup=1' : '/app'}
          signUpFallbackRedirectUrl={isPopup ? '/sso-callback?popup=1' : '/app'}
          signInForceRedirectUrl={isPopup ? undefined : '/app'}
          signUpForceRedirectUrl={isPopup ? undefined : '/app'}
          continueSignUpUrl="/signup"
        />
      </div>
    </PageTransition>
  );
}
