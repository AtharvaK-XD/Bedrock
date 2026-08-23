import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { cn } from '../../lib/utils';

interface Point {
  x: number;
  y: number;
  age: number;
}

export const CustomCursor = () => {
  const cursorRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  
  // Track mouse coordinates
  const mouse = useRef({ x: -100, y: -100 });
  const delayedMouse = useRef({ x: -100, y: -100 });
  
  // Trail state
  const points = useRef<Point[]>([]);

  useEffect(() => {
    // Canvas setup
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    // Hover state management
    const manageHoverState = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isHoverable = target.closest('a, button, input, [data-cursor="hover"]');
      
      if (cursorRef.current && dotRef.current) {
        if (isHoverable) {
          gsap.to(cursorRef.current, { scale: 2.5, backgroundColor: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.5)', duration: 0.3 });
          gsap.to(dotRef.current, { scale: 0, opacity: 0, duration: 0.2 });
        } else {
          gsap.to(cursorRef.current, { scale: 1, backgroundColor: 'transparent', border: '1px solid rgba(255, 255, 255, 0.3)', duration: 0.3 });
          gsap.to(dotRef.current, { scale: 1, opacity: 1, duration: 0.2 });
        }
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      const x = e.clientX;
      const y = e.clientY;
      
      // Interpolate points for fast mouse movements to ensure a smooth web
      if (mouse.current.x !== -100) {
        const dx = x - mouse.current.x;
        const dy = y - mouse.current.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > 15) {
           const steps = Math.floor(dist / 15);
           for(let i=1; i<=steps; i++) {
              points.current.push({
                x: mouse.current.x + (dx * (i/steps)),
                y: mouse.current.y + (dy * (i/steps)),
                age: 0
              });
           }
        }
      }

      mouse.current.x = x;
      mouse.current.y = y;
      setIsVisible(true);
      manageHoverState(e);
      
      // Instantly move the dot
      if (dotRef.current) {
        gsap.set(dotRef.current, { x: mouse.current.x, y: mouse.current.y });
      }

      points.current.push({ x, y, age: 0 });
    };

    const onMouseLeave = () => setIsVisible(false);
    const onMouseEnter = () => setIsVisible(true);

    window.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseleave', onMouseLeave);
    document.addEventListener('mouseenter', onMouseEnter);

    // Animation loop
    let requestRef: number;
    const animate = () => {
      // Outer ring lagging effect
      delayedMouse.current.x += (mouse.current.x - delayedMouse.current.x) * 0.15;
      delayedMouse.current.y += (mouse.current.y - delayedMouse.current.y) * 0.15;
      
      if (cursorRef.current) {
        gsap.set(cursorRef.current, { 
          x: delayedMouse.current.x, 
          y: delayedMouse.current.y 
        });
      }

      // Canvas constellation trail
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const maxAge = 45; 
      
      // Update ages and filter out old points
      points.current = points.current.filter(p => {
        p.age += 1;
        return p.age < maxAge;
      });

      // Draw single smooth trail line
      if (points.current.length > 1) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (let i = 0; i < points.current.length - 1; i++) {
          const p1 = points.current[i];
          const p2 = points.current[i + 1];
          
          const ageOpacity = 1 - p1.age / maxAge;
          
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(255, 255, 255, ${ageOpacity})`;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      requestRef = requestAnimationFrame(animate);
    };
    requestRef = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', resize);
      document.removeEventListener('mouseleave', onMouseLeave);
      document.removeEventListener('mouseenter', onMouseEnter);
      cancelAnimationFrame(requestRef);
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className={cn(
          "fixed inset-0 pointer-events-none z-[9998] mix-blend-difference transition-opacity duration-300",
          isVisible ? "opacity-100" : "opacity-0"
        )}
      />
      {/* Outer lagging ring */}
      <div 
        ref={cursorRef} 
        className={cn(
          "fixed top-0 left-0 w-10 h-10 -ml-5 -mt-5 rounded-full border border-white/30 pointer-events-none z-[9999] mix-blend-difference transition-opacity duration-300",
          isVisible ? "opacity-100" : "opacity-0"
        )}
      />
      {/* Inner instant dot */}
      <div 
        ref={dotRef} 
        className={cn(
          "fixed top-0 left-0 w-1.5 h-1.5 -ml-[3px] -mt-[3px] rounded-full bg-white pointer-events-none z-[10000] mix-blend-difference transition-opacity duration-300",
          isVisible ? "opacity-100" : "opacity-0"
        )}
      />
    </>
  );
};
