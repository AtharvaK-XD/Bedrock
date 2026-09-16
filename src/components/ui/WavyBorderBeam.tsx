import React from 'react';
import { BorderBeam } from 'border-beam';
import { cn } from '../../lib/utils';

interface WavyBorderBeamProps {
  children: React.ReactNode;
  className?: string;
  borderRadius?: number;
}

export function WavyBorderBeam({
  children,
  className,
  borderRadius = 24,
}: WavyBorderBeamProps) {
  return (
    <div className={cn("relative group w-full", className)}>
      {/* 1. Tight Ambient Chromatic Halo (Hugs close to the card edge, 6px-10px) */}
      <div 
        className="pointer-events-none absolute -inset-[2px] rounded-[26px] opacity-45 mix-blend-screen blur-[10px] sm:blur-[14px] overflow-hidden -z-10"
        aria-hidden="true"
      >
        <div 
          className="w-full h-full animate-[wavy-aurora-spin_12s_linear_infinite]"
          style={{
            background: `conic-gradient(
              from 0deg at 50% 50%,
              rgba(34, 211, 238, 0.6) 0deg,
              rgba(244, 63, 94, 0.65) 75deg,
              rgba(168, 85, 247, 0.7) 150deg,
              rgba(59, 130, 246, 0.65) 225deg,
              rgba(16, 185, 129, 0.55) 300deg,
              rgba(34, 211, 238, 0.6) 360deg
            )`
          }}
        />
      </div>

      {/* 2. Primary Core BorderBeam from libraries.dev (Travelling edge light) */}
      <BorderBeam
        size="md"
        colorVariant="colorful"
        borderRadius={borderRadius}
        strength={0.85}
        brightness={1.3}
        saturation={1.2}
        className="rounded-3xl relative"
        style={{
          '--beam-bloom-opacity': 1.1,
          '--beam-inner-opacity': 0.9,
        } as React.CSSProperties}
      >
        {/* Subtle top rim light reflection (tight 12px rim, does not wash over the card) */}
        <div className="relative w-full h-full rounded-3xl overflow-visible">
          <div 
            className="pointer-events-none absolute inset-x-0 top-0 h-10 rounded-t-3xl opacity-15 mix-blend-screen bg-gradient-to-b from-rose-500/20 via-cyan-500/10 to-transparent z-10 animate-[wavy-inner-pulse_6s_ease-in-out_infinite]"
            aria-hidden="true"
          />
          {children}
        </div>
      </BorderBeam>
    </div>
  );
}
