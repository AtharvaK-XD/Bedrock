import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Landing from './pages/Landing';
import Wizard from './pages/Wizard';
import Result from './pages/Result';
import Optimizer from './pages/Optimizer';
import PromptTester from './pages/PromptTester';
import Library from './pages/Library';
import { AppLayout } from './components/layout/AppLayout';

gsap.registerPlugin(ScrollTrigger);

const queryClient = new QueryClient();

function App() {
  useEffect(() => {
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
        <Routes>
          {/* Public Route (No AppLayout) */}
          <Route path="/" element={<Landing />} />
          
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
                </Routes>
              </AppLayout>
            } 
          />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
