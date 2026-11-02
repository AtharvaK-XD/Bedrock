import { useEffect, useRef, useState } from 'react';
import { animate } from 'framer-motion';

/** Counts up to a whole number when it first appears or changes. Shows the final value straight away if motion is reduced. */
export function CountUp({ value, duration = 0.9 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(value);
  const previous = useRef(0);

  useEffect(() => {
    const reduce =
      document.documentElement.classList.contains('reduce-motion') ||
      (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (reduce) {
      previous.current = value;
      setDisplay(value);
      return;
    }
    const controls = animate(previous.current, value, {
      duration,
      ease: 'easeOut',
      onUpdate: (latest) => setDisplay(Math.round(latest)),
    });
    previous.current = value;
    return () => controls.stop();
  }, [value, duration]);

  return <>{display.toLocaleString()}</>;
}
