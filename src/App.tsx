import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Landing from './pages/Landing';
import Wizard from './pages/Wizard';
import Result from './pages/Result';
import Optimizer from './pages/Optimizer';
import PromptTester from './pages/PromptTester';
import Library from './pages/Library';
import Pricing from './pages/Pricing';
import SettingsPage from './pages/Settings';
import { AppLayout } from './components/layout/AppLayout';
import { Topbar } from './components/layout/Topbar';
import { checkForUpdates } from './lib/updater';

gsap.registerPlugin(ScrollTrigger);

const queryClient = new QueryClient();

function AnimatedRoutes() {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Public Route (No AppLayout) */}
        <Route 
          path="/" 
          element={
            ('__TAURI_INTERNALS__' in window) ? <Navigate to="/app" replace /> : <Landing />
          } 
        />
        
        {/* App Routes (Wrapped in AppLayout) */}
        <Route 
          path="/app/*" 
          element={
            <AppLayout>
              <Routes>
                <Route path="/" element={<Wizard />} />
                <Route path="/optimizer" element={<Optimizer />} />
                <Route path="/tester" element={<PromptTester />} />
                <Route path="/library" element={<Library />} />
                <Route path="/result" element={<Result />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </AppLayout>
          } 
        />
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
        <Topbar />
        <AnimatedRoutes />
      </Router>
    </QueryClientProvider>
  );
}

export default App;
