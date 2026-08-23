import { useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';

interface Star {
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
}

export function StarBackground({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let stars: Star[] = [];
    let animationFrameId: number;

    const initStars = () => {
      stars = [];
      const numStars = Math.floor((window.innerWidth * window.innerHeight) / 3000); // Density

      for (let i = 0; i < numStars; i++) {
        // Distribute stars in 3 depth layers
        const layer = Math.random();
        let size, speed, opacity;

        if (layer < 0.1) {
          // Foreground (Fast, large, bright)
          size = Math.random() * 1.5 + 1;
          speed = Math.random() * 0.2 + 0.1;
          opacity = Math.random() * 0.5 + 0.5;
        } else if (layer < 0.4) {
          // Midground
          size = Math.random() * 1 + 0.5;
          speed = Math.random() * 0.1 + 0.05;
          opacity = Math.random() * 0.4 + 0.2;
        } else {
          // Background (Slow, small, dim)
          size = Math.random() * 0.5 + 0.2;
          speed = Math.random() * 0.05 + 0.01;
          opacity = Math.random() * 0.2 + 0.1;
        }

        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size,
          speed,
          opacity
        });
      }
    };

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initStars();
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      stars.forEach((star) => {
        // Move star to the right (slow motion)
        star.x -= star.speed;

        // Reset if it goes off screen
        if (star.x < 0) {
          star.x = canvas.width;
          star.y = Math.random() * canvas.height;
        }

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={cn("fixed inset-0 pointer-events-none w-full h-full block z-0", className)}
      style={{ background: 'transparent' }}
    />
  );
}
