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
import Pricing from './pages/Pricing';
import Billing from './pages/Billing';
import SettingsPage from './pages/Settings';
import Profile from './pages/Profile';
import AuthPage from './pages/Auth';
import { AppLayout } from './components/layout/AppLayout';
import SSOCallback from './pages/SSOCallback';
import { ClerkProvider } from '@clerk/react';
import { checkForUpdates } from './lib/updater';
import { useAuth } from './lib/useAuth';
import { isDesktopApp } from './lib/platform';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!PUBLISHABLE_KEY) {
  console.warn("Missing VITE_CLERK_PUBLISHABLE_KEY in .env.local");
}

gsap.registerPlugin(ScrollTrigger);

const queryClient = new QueryClient();

function AnimatedRoutes() {
  const location = useLocation();
  const { isLoggedIn } = useAuth();
  const isDesktop = isDesktopApp();
  
  useEffect(() => {
    window.scrollTo(0, 0);
    ScrollTrigger.refresh();
  }, [location.pathname]);
  
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Root Route:
            - Website (browser/Vercel): STRICTLY the original Landing page
            - Desktop app: Login required on first launch, then goes to generator
        */}
        <Route 
          path="/" 
          element={
            isDesktop ? (
              isLoggedIn ? <Navigate to="/app/generator" replace /> : <Navigate to="/login" replace />
            ) : (
              <Landing />
            )
          } 
        />

        {/* Auth routes */}
        <Route 
          path="/login" 
          element={
            isDesktop && isLoggedIn ? <Navigate to="/app/generator" replace /> : <AuthPage defaultMode="login" />
          } 
        />
        <Route 
          path="/signin" 
          element={
            isDesktop && isLoggedIn ? <Navigate to="/app/generator" replace /> : <AuthPage defaultMode="login" />
          } 
        />
        <Route 
          path="/signup" 
          element={
            isDesktop && isLoggedIn ? <Navigate to="/app/generator" replace /> : <AuthPage defaultMode="register" />
          } 
        />
        <Route 
          path="/register" 
          element={
            isDesktop && isLoggedIn ? <Navigate to="/app/generator" replace /> : <AuthPage defaultMode="register" />
          } 
        />
        <Route path="/join" element={<AuthPage defaultMode="register" />} />
        <Route path="/sso-callback" element={<SSOCallback />} />
        <Route path="/profile" element={<Navigate to="/app/profile" replace />} />
        
        {/* App Routes (Wrapped in AppLayout) */}
        <Route 
          path="/app/*" 
          element={
            isDesktop ? (
              // Desktop App: Enforces login guard, directs to generator, omits web SaaS pages
              isLoggedIn ? (
                <AppLayout>
                  <Routes>
                    <Route path="/" element={<Navigate to="/app/generator" replace />} />
                    <Route path="/generator" element={<Wizard />} />
                    <Route path="/branching" element={<BranchingChat />} />
                    <Route path="/tester" element={<PromptTester />} />
                    <Route path="/library" element={<Library />} />
                    <Route path="/result" element={<Result />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/pricing" element={<Navigate to="/app/generator" replace />} />
                    <Route path="/billing" element={<Navigate to="/app/generator" replace />} />
                    <Route path="*" element={<Navigate to="/app/generator" replace />} />
                  </Routes>
                </AppLayout>
              ) : (
                <Navigate to="/login" replace />
              )
            ) : (
              // Website: Full original web application strictly as it was
              <AppLayout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/generator" element={<Wizard />} />
                  <Route path="/branching" element={<BranchingChat />} />
                  <Route path="/tester" element={<PromptTester />} />
                  <Route path="/library" element={<Library />} />
                  <Route path="/result" element={<Result />} />
                  <Route path="/pricing" element={<Pricing />} />
                  <Route path="/billing" element={<Billing />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/profile" element={<Profile />} />
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
              <Navigate to={isLoggedIn ? "/app/generator" : "/login"} replace />
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
  const RouterComponent = isDesktop ? HashRouter : BrowserRouter;

  useEffect(() => {
    // Check for Tauri updates
    checkForUpdates();
    
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
        </RouterComponent>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;
