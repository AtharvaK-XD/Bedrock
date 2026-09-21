import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Wizard from './pages/Wizard';
import Result from './pages/Result';
import BranchingChat from './pages/BranchingChat';
import PromptTester from './pages/PromptTester';
import Library from './pages/Library';
import SettingsPage from './pages/Settings';
import Profile from './pages/Profile';
import AuthPage from './pages/Auth';
import { AppLayout } from './components/layout/AppLayout';
import { checkForUpdates } from './lib/updater';
import { useAuth } from './lib/useAuth';

gsap.registerPlugin(ScrollTrigger);

const queryClient = new QueryClient();

function AnimatedRoutes() {
  const location = useLocation();
  const { isLoggedIn } = useAuth();
  
  useEffect(() => {
    window.scrollTo(0, 0);
    ScrollTrigger.refresh();
  }, [location.pathname]);
  
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Root entry: If logged in, launch workspace; otherwise, launch login */}
        <Route 
          path="/" 
          element={
            isLoggedIn ? <Navigate to="/app/generator" replace /> : <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/login" 
          element={isLoggedIn ? <Navigate to="/app/generator" replace /> : <AuthPage defaultMode="login" />} 
        />
        <Route 
          path="/signin" 
          element={isLoggedIn ? <Navigate to="/app/generator" replace /> : <AuthPage defaultMode="login" />} 
        />
        <Route 
          path="/signup" 
          element={isLoggedIn ? <Navigate to="/app/generator" replace /> : <AuthPage defaultMode="register" />} 
        />
        <Route 
          path="/register" 
          element={isLoggedIn ? <Navigate to="/app/generator" replace /> : <AuthPage defaultMode="register" />} 
        />
        <Route path="/join" element={<Navigate to="/login" replace />} />
        
        {/* Desktop App Routes (Wrapped in AppLayout & Protected by Auth Guard) */}
        <Route 
          path="/app/*" 
          element={
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
                  {/* Web SaaS-only routes redirect to generator in desktop app */}
                  <Route path="/pricing" element={<Navigate to="/app/generator" replace />} />
                  <Route path="/billing" element={<Navigate to="/app/generator" replace />} />
                  <Route path="*" element={<Navigate to="/app/generator" replace />} />
                </Routes>
              </AppLayout>
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />
        <Route path="*" element={<Navigate to={isLoggedIn ? "/app/generator" : "/login"} replace />} />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  useEffect(() => {
    // Check for Tauri updates
    checkForUpdates();
    
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
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AnimatedRoutes />
      </Router>
    </QueryClientProvider>
  );
}

export default App;
