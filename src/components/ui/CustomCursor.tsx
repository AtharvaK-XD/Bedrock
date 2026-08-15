import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { cn } from '../../lib/utils';

export const CustomCursor = () => {
  const cursorRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  
  // Track mouse coordinates
  const mouse = useRef({ x: 0, y: 0 });
  const delayedMouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    // Hide default cursor
    document.body.style.cursor = 'none';

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
      mouse.current.x = e.clientX;
      mouse.current.y = e.clientY;
      setIsVisible(true);
      manageHoverState(e);
      
      // Instantly move the dot
      if (dotRef.current) {
        gsap.set(dotRef.current, { x: mouse.current.x, y: mouse.current.y });
      }
    };

    const onMouseLeave = () => setIsVisible(false);
    const onMouseEnter = () => setIsVisible(true);

    window.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseleave', onMouseLeave);
    document.addEventListener('mouseenter', onMouseEnter);

    // Animation loop for the outer ring (lagging effect)
    let requestRef: number;
    const animate = () => {
      delayedMouse.current.x += (mouse.current.x - delayedMouse.current.x) * 0.15;
      delayedMouse.current.y += (mouse.current.y - delayedMouse.current.y) * 0.15;
      
      if (cursorRef.current) {
        gsap.set(cursorRef.current, { 
          x: delayedMouse.current.x, 
          y: delayedMouse.current.y 
        });
      }
      requestRef = requestAnimationFrame(animate);
    };
    requestRef = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseleave', onMouseLeave);
      document.removeEventListener('mouseenter', onMouseEnter);
      cancelAnimationFrame(requestRef);
      document.body.style.cursor = 'auto';
    };
  }, []);

  return (
    <>
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
