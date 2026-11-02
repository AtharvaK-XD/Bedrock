import { useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';

interface Star {
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
  tinted: boolean;
}

/**
 * Slow-moving stars behind the app (Settings > Appearance > Starfield background).
 * The brightest stars take the accent colour. With reduced motion it draws one still frame.
 */
export function StarBackground({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceMotion =
      document.documentElement.classList.contains('reduce-motion') ||
      (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    let stars: Star[] = [];
    let animationFrameId = 0;
    let accentRgb = '79, 176, 161';

    const readAccent = () => {
      const raw = getComputedStyle(document.documentElement).getPropertyValue('--copper-300').trim();
      if (raw) accentRgb = raw.split(/\s+/).join(', ');
    };

    const initStars = () => {
      stars = [];
      const numStars = Math.floor((window.innerWidth * window.innerHeight) / 4500);

      for (let i = 0; i < numStars; i++) {
        // Three depth layers: few bright and fast, many dim and slow
        const layer = Math.random();
        let size: number, speed: number, opacity: number;

        if (layer < 0.1) {
          size = Math.random() * 1.5 + 1;
          speed = Math.random() * 0.2 + 0.1;
          opacity = Math.random() * 0.5 + 0.5;
        } else if (layer < 0.4) {
          size = Math.random() * 1 + 0.5;
          speed = Math.random() * 0.1 + 0.05;
          opacity = Math.random() * 0.4 + 0.2;
        } else {
          size = Math.random() * 0.5 + 0.2;
          speed = Math.random() * 0.05 + 0.01;
          opacity = Math.random() * 0.2 + 0.1;
        }

        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size,
          speed,
          opacity,
          tinted: layer < 0.1,
        });
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const star of stars) {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = star.tinted ? `rgba(${accentRgb}, ${star.opacity})` : `rgba(255, 255, 255, ${star.opacity})`;
        ctx.fill();
      }
    };

    const step = () => {
      for (const star of stars) {
        star.x -= star.speed;
        if (star.x < 0) {
          star.x = canvas.width;
          star.y = Math.random() * canvas.height;
        }
      }
      draw();
      animationFrameId = requestAnimationFrame(step);
    };

    const start = () => {
      cancelAnimationFrame(animationFrameId);
      if (reduceMotion) draw();
      else animationFrameId = requestAnimationFrame(step);
    };

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initStars();
      readAccent();
      start();
    };

    // No point drawing while the window is hidden
    const handleVisibility = () => {
      if (document.hidden) cancelAnimationFrame(animationFrameId);
      else start();
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn('fixed inset-0 pointer-events-none w-full h-full block z-0', className)}
      style={{ background: 'transparent' }}
    />
  );
}
