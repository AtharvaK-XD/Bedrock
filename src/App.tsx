import { useEffect } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Wizard from './pages/Wizard';
import Result from './pages/Result';
import BranchingChat from './pages/BranchingChat';
import PromptTester from './pages/PromptTester';
import Library from './pages/Library';
import History from './pages/History';
import Pricing from './pages/Pricing';
import Billing from './pages/Billing';
import SettingsPage from './pages/Settings';
import Profile from './pages/Profile';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import AuthPage from './pages/Auth';
import { AppLayout } from './components/layout/AppLayout';
import SSOCallback from './pages/SSOCallback';
import BrowserAuth from './pages/BrowserAuth';
import BrowserAuthCallback from './pages/BrowserAuthCallback';
import PopupAuth from './pages/PopupAuth';
import { ClerkProvider } from '@clerk/react';
import { checkForUpdates } from './lib/updater';
import { useAuth } from './lib/useAuth';
import { isDesktopApp } from './lib/platform';
import { UpdateBanner } from './components/layout/UpdateBanner';
import { applyAppearanceToDom, BEDROCK_APPEARANCE_UPDATED_EVENT } from './lib/appSettings';
import { ExternalLink } from 'lucide-react';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!PUBLISHABLE_KEY) {
  console.warn("Missing VITE_CLERK_PUBLISHABLE_KEY in .env.local");
}

gsap.registerPlugin(ScrollTrigger);

const queryClient = new QueryClient();

function BrowserDesktopNotice() {
  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans select-none">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-emerald-500/10 blur-[180px] pointer-events-none rounded-full" />
      <div className="relative z-10 w-full max-w-md bg-zinc-950/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 sm:p-10 shadow-2xl text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/10 p-2.5 mx-auto flex items-center justify-center shadow-xl ring-1 ring-white/10">
          <img 
            src="/logo-tight.png" 
            alt="Bedrock Logo" 
            className="w-full h-full object-contain filter drop-shadow-[0_0_12px_rgba(139,212,186,0.35)]" 
          />
        </div>
        <div>
          <h2 className="text-2xl font-display font-bold text-white tracking-tight">
            Bedrock Desktop Active
          </h2>
          <p className="text-zinc-400 mt-2 text-sm leading-relaxed">
            The Bedrock Workstation runs inside your Desktop Application. You can safely close this browser window and use Bedrock Desktop.
          </p>
        </div>
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => { window.location.href = 'bedrock://'; }}
            className="w-full flex items-center justify-center gap-2 bg-[#2C9A8B] text-white rounded-xl py-3.5 font-semibold hover:bg-[#1F7A6E] transition-all cursor-pointer text-sm shadow-lg shadow-[#2C9A8B]/25 active:scale-[0.98]"
          >
            <ExternalLink className="w-4 h-4" />
            Return to Bedrock Desktop
          </button>
          <button
            type="button"
            onClick={() => {
              try { window.close(); } catch {}
            }}
            className="w-full py-2.5 text-xs text-zinc-500 hover:text-zinc-300 font-mono transition-colors cursor-pointer"
          >
            Close this tab
          </button>
        </div>
      </div>
    </div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  const { isLoggedIn, isLoaded } = useAuth();
  const isDesktop = isDesktopApp();

  const isExternalLoopback = 
    !isDesktop && 
    typeof window !== 'undefined' && 
    (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost');

  if (
    isExternalLoopback && 
    location.pathname !== '/browser-auth' && 
    location.pathname !== '/browser-auth-callback'
  ) {
    return <BrowserDesktopNotice />;
  }
  
  useEffect(() => {
    // Desktop App (Electron/Tauri): uses HashRouter, so redirect raw callback URLs to hash routes
    if (isDesktop && typeof window !== 'undefined' && !window.location.hash) {
      if (
        window.location.pathname.includes('browser-auth') ||
        window.location.pathname.includes('sso-callback')
      ) {
        window.location.replace(`${window.location.origin}/#${window.location.pathname}${window.location.search}`);
        return;
      }
    }

    // Web Browser Mode (Vercel): uses BrowserRouter; if an external callback erroneously has a hash, restore clean browser pathname
    if (!isDesktop && typeof window !== 'undefined' && window.location.hash && window.location.hash.includes('sso-callback')) {
      const cleanPath = window.location.hash.replace(/^#/, '');
      window.location.replace(`${window.location.origin}${cleanPath}`);
      return;
    }

    window.scrollTo(0, 0);
    ScrollTrigger.refresh();
  }, [location.pathname, isDesktop]);

  // OAuth Popup Safeguard: if an OAuth popup reaches /app, close it immediately
  useEffect(() => {
    const isPopup = 
      (typeof window !== 'undefined' && window.name === 'BedrockOAuth') ||
      (typeof window !== 'undefined' && window.sessionStorage?.getItem('bedrock_auth_popup') === '1') ||
      (typeof window !== 'undefined' && window.location.search?.includes('popup=1'));

    if (isPopup && location.pathname.startsWith('/app')) {
      try {
        if (window.opener) {
          window.opener.postMessage('clerk-auth-complete', '*');
        }
        localStorage.setItem('bedrock_auth_event', Date.now().toString());
        sessionStorage.removeItem('bedrock_auth_popup');
      } catch {}
      window.close();
      setTimeout(() => window.close(), 50);
      setTimeout(() => window.close(), 200);
    }
  }, [location.pathname]);
  
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Root Route:
            - If authenticated (within 7-day active window): navigate directly to /app Dashboard
            - If unauthenticated / expired:
                * Desktop app: redirect to /login
                * Website: show Landing page for first-time sign up / sign in
        */}
        <Route 
          path="/" 
          element={
            !isLoaded ? (
              <div className="flex items-center justify-center min-h-screen bg-[#050505]">
                <div className="w-8 h-8 border-2 border-white/20 border-t-copper-500 rounded-full animate-spin"></div>
              </div>
            ) : isLoggedIn ? (
              <Navigate to="/app" replace />
            ) : isDesktop ? (
              <Navigate to="/login" replace />
            ) : (
              <Landing />
            )
          } 
        />

        {/* Auth routes */}
        <Route 
          path="/login" 
          element={
            isLoggedIn ? <Navigate to="/app" replace /> : <AuthPage defaultMode="login" />
          } 
        />
        <Route 
          path="/signin" 
          element={
            isLoggedIn ? <Navigate to="/app" replace /> : <AuthPage defaultMode="login" />
          } 
        />
        <Route 
          path="/signup" 
          element={
            isLoggedIn ? <Navigate to="/app" replace /> : <AuthPage defaultMode="register" />
          } 
        />
        <Route 
          path="/register" 
          element={
            isLoggedIn ? <Navigate to="/app" replace /> : <AuthPage defaultMode="register" />
          } 
        />
        <Route 
          path="/join" 
          element={
            isLoggedIn ? <Navigate to="/app" replace /> : <AuthPage defaultMode="register" />
          } 
        />
        <Route path="/sso-callback" element={<SSOCallback />} />
        <Route path="/popup-auth" element={<PopupAuth />} />
        <Route path="/browser-auth" element={<BrowserAuth />} />
        <Route path="/browser-auth-callback" element={<BrowserAuthCallback />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/profile" element={<Navigate to="/app/profile" replace />} />
        
        {/* App Routes (Strictly protected by authentication) */}
        <Route 
          path="/app/*" 
          element={
            !isLoaded ? (
              <div className="flex items-center justify-center min-h-screen bg-[#050505]">
                <div className="w-8 h-8 border-2 border-white/20 border-t-copper-500 rounded-full animate-spin"></div>
              </div>
            ) : !isLoggedIn ? (
              <Navigate to={isDesktop ? "/login" : "/"} replace />
            ) : (
              <AppLayout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/generator" element={<Wizard />} />
                  <Route path="/branching" element={<BranchingChat />} />
                  <Route path="/tester" element={<PromptTester />} />
                  <Route path="/library" element={<Library />} />
                  <Route path="/history" element={<History />} />
                  <Route path="/result" element={<Result />} />
                  <Route path="/pricing" element={isDesktop ? <Navigate to="/app" replace /> : <Pricing />} />
                  <Route path="/billing" element={isDesktop ? <Navigate to="/app" replace /> : <Billing />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="*" element={<Navigate to="/app" replace />} />
                </Routes>
              </AppLayout>
            )
          } 
        />

        {/* Catch-all */}
        <Route 
          path="*" 
          element={
            isDesktop ? (
              <Navigate to={isLoggedIn ? "/app" : "/login"} replace />
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  const isDesktop = isDesktopApp();
  const isHashRouted = isDesktop || (typeof window !== 'undefined' && Boolean(window.location.hash));
  const RouterComponent = isHashRouted ? HashRouter : BrowserRouter;

  useEffect(() => {
    // Check for Tauri updates
    checkForUpdates();

    // Initialize and synchronize appearance settings across the DOM
    applyAppearanceToDom();
    const handleAppearanceChange = () => applyAppearanceToDom();
    window.addEventListener(BEDROCK_APPEARANCE_UPDATED_EVENT, handleAppearanceChange);
    window.addEventListener('storage', handleAppearanceChange);

    return () => {
      window.removeEventListener(BEDROCK_APPEARANCE_UPDATED_EVENT, handleAppearanceChange);
      window.removeEventListener('storage', handleAppearanceChange);
    };
  }, []);

  useEffect(() => {
    // Only initialize smooth scroll on the web landing page; desktop app uses native scroll
    if (isDesktop) return;


    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
    });

    // Synchronize Lenis scrolling with GSAP's ScrollTrigger
    lenis.on('scroll', ScrollTrigger.update);

    // Use GSAP's ticker to drive Lenis's requestAnimationFrame
    const update = (time: number) => {
      lenis.raf(time * 1000);
    };
    
    gsap.ticker.add(update);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(update);
      lenis.destroy();
    };
  }, [isDesktop]);

  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
      <QueryClientProvider client={queryClient}>
        <RouterComponent>
          <AnimatedRoutes />
          <UpdateBanner />
        </RouterComponent>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;
